import crypto from "node:crypto";
import type {
  AccessPolicy,
  AccessPolicyResponse,
  CreatedEpisode,
  CreateEpisodeRequest,
  CreatePackagingRequest,
  CreateSeriesRequest,
  CreateSeriesResponse,
  DraftEpisode,
  StudioSeriesSummary,
  EpisodeVisibility,
  PackagingRequest,
  ReplaceEpisodePagesRequest,
  SeasonStatus,
  SeriesCoverResponse,
  SeriesInfoResponse,
  StudioSeasonResponse,
  UpdateEpisodeRequest,
  UpdateSeriesInfoRequest,
  UploadPreview,
} from "../contracts/studio";
import {
  CoverValidationError,
  processCoverImage,
} from "../uploads/cover-image";
import {
  StudioRepositoryError,
  type StudioRepository,
  type StudioEpisode,
} from "../repositories/studio-repository";
import {
  analyzeArchive,
  ArchiveValidationError,
} from "../uploads/archive-analyzer";
import type { StudioStorage } from "../uploads/upload-session-storage";
import {
  MalwareDetectedError,
  MalwareScannerUnavailableError,
  NoopMalwareScanner,
  type MalwareScanner,
} from "../security/malware-scanner";

export class StudioServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StudioServiceError";
  }
}

export interface StudioUseCases {
  previewArchive(
    originalName: string,
    buffer: Buffer,
  ): Promise<UploadPreview>;
  getPreviewPath(
    sessionId: string,
    pageId: string,
  ): Promise<string>;
  createEpisode(input: CreateEpisodeRequest): Promise<CreatedEpisode>;
  cancelUpload(sessionId: string): Promise<void>;
  updateAccessPolicy(
    seriesId: string,
    input: AccessPolicy,
  ): Promise<AccessPolicyResponse>;
  updateSeriesInfo(
    seriesId: string,
    input: UpdateSeriesInfoRequest,
  ): Promise<SeriesInfoResponse>;
  createSeries(input: CreateSeriesRequest): Promise<CreateSeriesResponse>;
  updateSeasonStatus(
    seasonId: string,
    status: SeasonStatus,
  ): Promise<StudioSeasonResponse>;
  createSeason(seriesId: string): Promise<StudioSeasonResponse>;
  deleteEpisode(episodeId: string): Promise<void>;
  setEpisodeVisibility(
    episodeId: string,
    visibility: EpisodeVisibility,
  ): Promise<DraftEpisode>;
  updateEpisode(
    episodeId: string,
    input: UpdateEpisodeRequest,
  ): Promise<DraftEpisode>;
  updateSeriesCover(
    seriesId: string,
    image: Buffer,
  ): Promise<SeriesCoverResponse>;
  replaceEpisodePages(
    episodeId: string,
    input: ReplaceEpisodePagesRequest,
  ): Promise<CreatedEpisode>;
  listStudioSeries(): Promise<StudioSeriesSummary[]>;
  listDraftEpisodes(): Promise<DraftEpisode[]>;
  createPackagingRequest(
    input: CreatePackagingRequest,
  ): Promise<PackagingRequest>;
  listPackagingRequests(): Promise<PackagingRequest[]>;
  updatePackagingStatus(
    id: string,
    status: "reviewing" | "completed" | "canceled",
  ): Promise<PackagingRequest>;
}

// 접수(received)에서 시작해 검토를 거쳐 종료 상태로만 진행한다.
const PACKAGING_TRANSITIONS: Record<string, string[]> = {
  received: ["reviewing", "canceled"],
  reviewing: ["completed", "canceled"],
  completed: [],
  canceled: [],
};

export class StudioService implements StudioUseCases {
  constructor(
    private readonly repository: StudioRepository,
    private readonly storage: StudioStorage,
    private readonly malwareScanner: MalwareScanner = new NoopMalwareScanner(),
  ) {}

  async previewArchive(
    originalName: string,
    buffer: Buffer,
  ): Promise<UploadPreview> {
    try {
      await this.malwareScanner.scan(buffer);
    } catch (error) {
      if (error instanceof MalwareDetectedError) {
        throw new StudioServiceError(
          "ARCHIVE_MALWARE_DETECTED",
          "안전하지 않은 원고 파일이 감지되어 업로드를 중단했습니다.",
          422,
        );
      }
      if (error instanceof MalwareScannerUnavailableError) {
        throw new StudioServiceError(
          "MALWARE_SCANNER_UNAVAILABLE",
          "파일 안전 검사를 완료하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
          503,
        );
      }
      throw error;
    }
    let images;
    try {
      images = await analyzeArchive(buffer);
    } catch (error) {
      if (error instanceof ArchiveValidationError) {
        throw new StudioServiceError(error.code, error.message, 400);
      }
      throw error;
    }
    const session = await this.storage.createSession(originalName, images);
    return {
      sessionId: session.id,
      originalName: session.originalName,
      expiresAt: session.expiresAt,
      pages: session.pages.map((page) => ({
        id: page.id,
        originalName: page.originalName,
        byteSize: page.byteSize,
        previewUrl: `/api/studio/uploads/${session.id}/pages/${page.id}`,
      })),
    };
  }

  async getPreviewPath(
    sessionId: string,
    pageId: string,
  ): Promise<string> {
    const previewPath = await this.storage.getPreviewPath(sessionId, pageId);
    if (!previewPath) {
      throw new StudioServiceError(
        "UPLOAD_SESSION_NOT_FOUND",
        "미리보기 시간이 만료되었어요. ZIP 파일을 다시 올려 주세요.",
        404,
      );
    }
    return previewPath;
  }

  async createEpisode(
    input: CreateEpisodeRequest,
  ): Promise<CreatedEpisode> {
    const requestFingerprint = fingerprintStudioRequest("episode", input);
    const existing = await this.repository.findEpisodeByRequestKey(
      input.requestKey,
    );
    if (existing) {
      assertMatchingFingerprint(existing.requestFingerprint, requestFingerprint);
      return toCreatedEpisode(existing.episode, existing.pageCount);
    }

    const [season, session] = await Promise.all([
      this.repository.findSeason(input.seasonId),
      this.storage.getSession(input.sessionId),
    ]);
    if (!season) {
      throw new StudioServiceError(
        "SEASON_NOT_FOUND",
        "등록할 시즌을 찾을 수 없습니다.",
        404,
      );
    }
    if (season.status !== "ongoing") {
      throw new StudioServiceError(
        "SEASON_ALREADY_COMPLETED",
        "완결된 시즌에는 새 에피소드를 등록할 수 없습니다.",
        409,
      );
    }
    if (!session) {
      throw new StudioServiceError(
        "UPLOAD_SESSION_NOT_FOUND",
        "미리보기 시간이 만료되었어요. ZIP 파일을 다시 올려 주세요.",
        404,
      );
    }

    assertPageOrderCoversSession(input.pageIds, session);

    const publicationId = crypto.randomUUID();
    const published = await this.storage.publish(
      session,
      [
        season.series.slug,
        `s${season.number}`,
        `ep${input.number}-${publicationId}`,
      ],
      input.pageIds,
    );

    let createdEpisodeId: string | null = null;
    try {
      const created = await this.repository.createEpisode({
        requestKey: input.requestKey,
        requestFingerprint,
        seasonId: season.id,
        number: input.number,
        title: input.title,
        imageUrls: published.imageUrls,
        visibility: input.visibility,
        manuscriptDir: published.directory,
      });
      createdEpisodeId = created.id;
      await this.storage.removeSession(session.id);
      return {
        episodeId: created.id,
        seriesSlug: season.series.slug,
        pageCount: published.imageUrls.length,
        readerUrl: `/read/${created.id}`,
        visibility: input.visibility,
      };
    } catch (error) {
      if (createdEpisodeId) {
        await this.repository.deleteEpisode(createdEpisodeId);
      }
      await this.storage.removePublished(published.directory);
      if (error instanceof StudioRepositoryError) {
        if (error.code === "IDEMPOTENCY_KEY_EXISTS") {
          const raced = await this.repository.findEpisodeByRequestKey(
            input.requestKey,
          );
          if (raced) {
            assertMatchingFingerprint(
              raced.requestFingerprint,
              requestFingerprint,
            );
            return toCreatedEpisode(raced.episode, raced.pageCount);
          }
        }
        throw new StudioServiceError(
          error.code,
          "같은 회차 번호가 이미 있어요. 다른 번호를 입력해 주세요.",
          409,
        );
      }
      throw error;
    }
  }

  async cancelUpload(sessionId: string): Promise<void> {
    await this.storage.removeSession(sessionId);
  }

  async updateAccessPolicy(
    seriesId: string,
    input: AccessPolicy,
  ): Promise<AccessPolicyResponse> {
    const updated = await this.repository.updateAccessPolicy(
      seriesId,
      input.freeVolumeCount,
      input.previewEpisodeCount,
    );
    if (!updated) {
      throw new StudioServiceError(
        "SERIES_NOT_FOUND",
        "공개 정책을 바꿀 작품을 찾을 수 없습니다.",
        404,
      );
    }
    return updated;
  }

  async updateSeriesInfo(
    seriesId: string,
    input: UpdateSeriesInfoRequest,
  ): Promise<SeriesInfoResponse> {
    const updated = await this.repository.updateSeriesInfo(seriesId, input);
    if (!updated) {
      throw new StudioServiceError(
        "SERIES_NOT_FOUND",
        "정보를 바꿀 작품을 찾을 수 없습니다.",
        404,
      );
    }
    return updated;
  }

  async createSeries(
    input: CreateSeriesRequest,
  ): Promise<CreateSeriesResponse> {
    const requestFingerprint = fingerprintStudioRequest("series", input);
    const existing = await this.repository.findSeriesByRequestKey(
      input.requestKey,
    );
    if (existing) {
      assertMatchingFingerprint(existing.requestFingerprint, requestFingerprint);
      return existing.response;
    }
    try {
      return await this.repository.createSeries(input, requestFingerprint);
    } catch (error) {
      if (
        error instanceof StudioRepositoryError &&
        error.code === "IDEMPOTENCY_KEY_EXISTS"
      ) {
        const raced = await this.repository.findSeriesByRequestKey(
          input.requestKey,
        );
        if (raced) {
          assertMatchingFingerprint(
            raced.requestFingerprint,
            requestFingerprint,
          );
          return raced.response;
        }
      }
      if (
        error instanceof StudioRepositoryError &&
        error.code === "SERIES_SLUG_EXISTS"
      ) {
        throw new StudioServiceError(
          error.code,
          "같은 주소(slug)의 작품이 이미 있어요. 다른 slug를 입력해 주세요.",
          409,
        );
      }
      throw error;
    }
  }

  async updateSeasonStatus(
    seasonId: string,
    status: SeasonStatus,
  ): Promise<StudioSeasonResponse> {
    const updated = await this.repository.updateSeasonStatus(
      seasonId,
      status,
    );
    if (!updated) {
      throw new StudioServiceError(
        "SEASON_NOT_FOUND",
        "상태를 바꿀 시즌을 찾을 수 없습니다.",
        404,
      );
    }
    return updated;
  }

  async createSeason(seriesId: string): Promise<StudioSeasonResponse> {
    const created = await this.repository.createSeason(seriesId);
    if (!created) {
      throw new StudioServiceError(
        "SERIES_NOT_FOUND",
        "새 시즌을 만들 작품을 찾을 수 없습니다.",
        404,
      );
    }
    return created;
  }

  async deleteEpisode(episodeId: string): Promise<void> {
    const episode = await this.repository.findEpisode(episodeId);
    if (!episode) {
      throw new StudioServiceError(
        "EPISODE_NOT_FOUND",
        "삭제할 에피소드를 찾을 수 없습니다.",
        404,
      );
    }
    // 캔디로 영구 열람권을 산 독자의 자산을 지우지 않도록 삭제를 막는다.
    const paidReaders = await this.repository.countCandyEntitlements(
      episode.id,
    );
    if (paidReaders > 0) {
      throw new StudioServiceError(
        "EPISODE_HAS_PAID_READERS",
        "캔디로 열람한 독자가 있어 삭제할 수 없어요. 대신 비공개로 전환해 주세요.",
        409,
      );
    }
    await this.repository.deleteEpisode(episode.id);
    // DB에서 지워진 뒤 남은 발행 파일을 정리한다. 시드 원고는 대상이 아니다.
    if (episode.manuscriptDir) {
      await this.storage
        .removePublished(episode.manuscriptDir)
        .catch(() => undefined);
    }
  }

  async setEpisodeVisibility(
    episodeId: string,
    visibility: EpisodeVisibility,
  ): Promise<DraftEpisode> {
    const updated = await this.repository.setEpisodeVisibility(
      episodeId,
      visibility,
    );
    if (!updated) {
      throw new StudioServiceError(
        "EPISODE_NOT_FOUND",
        "공개 상태를 바꿀 에피소드를 찾을 수 없습니다.",
        404,
      );
    }
    return updated;
  }

  async updateEpisode(
    episodeId: string,
    input: UpdateEpisodeRequest,
  ): Promise<DraftEpisode> {
    let updated: DraftEpisode | null;
    try {
      updated = await this.repository.updateEpisode(episodeId, input);
    } catch (error) {
      if (
        error instanceof StudioRepositoryError &&
        error.code === "EPISODE_NUMBER_EXISTS"
      ) {
        throw new StudioServiceError(
          error.code,
          "같은 회차 번호가 이미 있어요. 다른 번호를 입력해 주세요.",
          409,
        );
      }
      throw error;
    }
    if (!updated) {
      throw new StudioServiceError(
        "EPISODE_NOT_FOUND",
        "수정할 에피소드를 찾을 수 없습니다.",
        404,
      );
    }
    return updated;
  }

  async updateSeriesCover(
    seriesId: string,
    image: Buffer,
  ): Promise<SeriesCoverResponse> {
    let processed: Buffer;
    try {
      processed = await processCoverImage(image);
    } catch (error) {
      if (error instanceof CoverValidationError) {
        throw new StudioServiceError(error.code, error.message, 400);
      }
      throw error;
    }
    const published = await this.storage.publishCover(seriesId, processed);
    const updated = await this.repository.updateSeriesCover(
      seriesId,
      published.url,
    );
    if (!updated) {
      await this.storage
        .removePublished(published.location)
        .catch(() => undefined);
      throw new StudioServiceError(
        "SERIES_NOT_FOUND",
        "표지를 바꿀 작품을 찾을 수 없습니다.",
        404,
      );
    }
    return updated;
  }

  async replaceEpisodePages(
    episodeId: string,
    input: ReplaceEpisodePagesRequest,
  ): Promise<CreatedEpisode> {
    const [episode, session] = await Promise.all([
      this.repository.findEpisode(episodeId),
      this.storage.getSession(input.sessionId),
    ]);
    if (!episode) {
      throw new StudioServiceError(
        "EPISODE_NOT_FOUND",
        "원고를 교체할 에피소드를 찾을 수 없습니다.",
        404,
      );
    }
    if (!session) {
      throw new StudioServiceError(
        "UPLOAD_SESSION_NOT_FOUND",
        "미리보기 시간이 만료되었어요. ZIP 파일을 다시 올려 주세요.",
        404,
      );
    }
    assertPageOrderCoversSession(input.pageIds, session);

    const publicationId = crypto.randomUUID();
    const published = await this.storage.publish(
      session,
      [
        episode.season.series.slug,
        `s${episode.season.number}`,
        `ep${episode.number}-${publicationId}`,
      ],
      input.pageIds,
    );
    try {
      await this.repository.replaceEpisodePages(
        episode.id,
        published.imageUrls,
        published.directory,
      );
    } catch (error) {
      await this.storage.removePublished(published.directory);
      throw error;
    }
    await this.storage.removeSession(session.id);
    // 이전 원고는 스튜디오 발행분일 때만 지운다. 시드 원고는 건드리지 않는다.
    if (episode.manuscriptDir) {
      await this.storage
        .removePublished(episode.manuscriptDir)
        .catch(() => undefined);
    }
    return {
      episodeId: episode.id,
      seriesSlug: episode.season.series.slug,
      pageCount: published.imageUrls.length,
      readerUrl: `/read/${episode.id}`,
      visibility: episode.visibility,
    };
  }

  async listStudioSeries(): Promise<StudioSeriesSummary[]> {
    return this.repository.listStudioSeries();
  }

  async listDraftEpisodes(): Promise<DraftEpisode[]> {
    return this.repository.listDraftEpisodes();
  }

  async createPackagingRequest(
    input: CreatePackagingRequest,
  ): Promise<PackagingRequest> {
    const requestFingerprint = fingerprintStudioRequest("packaging", input);
    const existing = await this.repository.findPackagingRequestByRequestKey(
      input.requestKey,
    );
    if (existing) {
      assertMatchingFingerprint(existing.requestFingerprint, requestFingerprint);
      return existing.response;
    }

    const session = await this.storage.getSession(input.sessionId);
    if (!session) {
      throw new StudioServiceError(
        "UPLOAD_SESSION_NOT_FOUND",
        "미리보기 시간이 만료되었어요. ZIP 파일을 다시 올려 주세요.",
        404,
      );
    }
    assertPageOrderCoversSession(input.pageIds, session);

    const requestId = crypto.randomUUID();
    const published = await this.storage.publish(
      session,
      ["packaging", requestId],
      input.pageIds,
    );
    try {
      const created = await this.repository.createPackagingRequest({
        requestKey: input.requestKey,
        requestFingerprint,
        applicantName: input.applicantName,
        bookTitle: input.bookTitle,
        bookSize: input.bookSize,
        coverType: input.coverType,
        quantity: input.quantity,
        memo: input.memo ?? null,
        pageCount: published.imageUrls.length,
        manuscriptDir: published.directory,
      });
      await this.storage.removeSession(session.id);
      return created;
    } catch (error) {
      await this.storage.removePublished(published.directory);
      if (
        error instanceof StudioRepositoryError &&
        error.code === "IDEMPOTENCY_KEY_EXISTS"
      ) {
        const raced =
          await this.repository.findPackagingRequestByRequestKey(
            input.requestKey,
          );
        if (raced) {
          assertMatchingFingerprint(
            raced.requestFingerprint,
            requestFingerprint,
          );
          return raced.response;
        }
      }
      throw error;
    }
  }

  async listPackagingRequests(): Promise<PackagingRequest[]> {
    return this.repository.listPackagingRequests();
  }

  async updatePackagingStatus(
    id: string,
    status: "reviewing" | "completed" | "canceled",
  ): Promise<PackagingRequest> {
    const current = await this.repository.findPackagingRequest(id);
    if (!current) {
      throw new StudioServiceError(
        "PACKAGING_NOT_FOUND",
        "상태를 바꿀 패키징 신청을 찾을 수 없습니다.",
        404,
      );
    }
    if (!PACKAGING_TRANSITIONS[current.status]?.includes(status)) {
      throw new StudioServiceError(
        "PACKAGING_TRANSITION_INVALID",
        "이미 종료됐거나 허용되지 않는 진행 순서예요.",
        409,
      );
    }
    const updated = await this.repository.updatePackagingStatus(id, status);
    if (!updated) {
      throw new StudioServiceError(
        "PACKAGING_NOT_FOUND",
        "상태를 바꿀 패키징 신청을 찾을 수 없습니다.",
        404,
      );
    }
    return updated;
  }
}

function fingerprintStudioRequest<T extends { requestKey: string }>(
  operation: "series" | "episode" | "packaging",
  input: T,
): string {
  const { requestKey: _requestKey, ...payload } = input;
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ operation, payload }))
    .digest("hex");
}

function assertMatchingFingerprint(
  existing: string,
  requested: string,
): void {
  if (existing !== requested) {
    throw new StudioServiceError(
      "IDEMPOTENCY_KEY_REUSED",
      "같은 요청 키를 다른 내용에 다시 사용할 수 없습니다.",
      409,
    );
  }
}

function toCreatedEpisode(
  episode: StudioEpisode,
  pageCount: number,
): CreatedEpisode {
  return {
    episodeId: episode.id,
    seriesSlug: episode.season.series.slug,
    pageCount,
    readerUrl: `/read/${episode.id}`,
    visibility: episode.visibility,
  };
}

function assertPageOrderCoversSession(
  pageIds: string[],
  session: { pages: Array<{ id: string }> },
): void {
  const uniquePageIds = new Set(pageIds);
  const sessionPageIds = new Set(session.pages.map((page) => page.id));
  if (
    uniquePageIds.size !== pageIds.length ||
    uniquePageIds.size !== sessionPageIds.size ||
    [...uniquePageIds].some((id) => !sessionPageIds.has(id))
  ) {
    throw new StudioServiceError(
      "PAGE_ORDER_INVALID",
      "미리보기의 모든 페이지를 한 번씩 순서대로 넣어 주세요.",
      400,
    );
  }
}
