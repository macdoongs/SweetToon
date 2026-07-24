import crypto from "node:crypto";
import type {
  AccessPolicy,
  AccessPolicyResponse,
  CreatedEpisode,
  CreateEpisodeRequest,
  UploadPreview,
} from "../contracts/studio";
import {
  StudioRepositoryError,
  type StudioRepository,
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
}

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

    const uniquePageIds = new Set(input.pageIds);
    const sessionPageIds = new Set(session.pages.map((page) => page.id));
    if (
      uniquePageIds.size !== input.pageIds.length ||
      uniquePageIds.size !== sessionPageIds.size ||
      [...uniquePageIds].some((id) => !sessionPageIds.has(id))
    ) {
      throw new StudioServiceError(
        "PAGE_ORDER_INVALID",
        "미리보기의 모든 페이지를 한 번씩 순서대로 넣어 주세요.",
        400,
      );
    }

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
        seasonId: season.id,
        number: input.number,
        title: input.title,
        imageUrls: published.imageUrls,
      });
      createdEpisodeId = created.id;
      await this.storage.removeSession(session.id);
      return {
        episodeId: created.id,
        seriesSlug: season.series.slug,
        pageCount: published.imageUrls.length,
        readerUrl: `/read/${created.id}`,
      };
    } catch (error) {
      if (createdEpisodeId) {
        await this.repository.deleteEpisode(createdEpisodeId);
      }
      await this.storage.removePublished(published.directory);
      if (error instanceof StudioRepositoryError) {
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
}
