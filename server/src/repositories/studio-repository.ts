import { Prisma, PrismaClient } from "@prisma/client";
import type {
  AccessPolicyResponse,
  DraftEpisode,
  EpisodeVisibility,
  PackagingRequest,
} from "../contracts/studio";

export type StudioSeason = {
  id: string;
  number: number;
  status: string;
  series: {
    id: string;
    slug: string;
    title: string;
  };
};

export type CreateStudioEpisodeInput = {
  seasonId: string;
  number: number;
  title: string;
  imageUrls: string[];
  visibility: EpisodeVisibility;
};

export type CreatePackagingRequestInput = {
  applicantName: string;
  bookTitle: string;
  bookSize: string;
  coverType: string;
  quantity: number;
  memo: string | null;
  pageCount: number;
  manuscriptDir: string;
};

export type CreatedStudioEpisode = {
  id: string;
};

export class StudioRepositoryError extends Error {
  constructor(readonly code: "EPISODE_NUMBER_EXISTS") {
    super(code);
    this.name = "StudioRepositoryError";
  }
}

export interface StudioRepository {
  findSeason(id: string): Promise<StudioSeason | null>;
  createEpisode(
    input: CreateStudioEpisodeInput,
  ): Promise<CreatedStudioEpisode>;
  deleteEpisode(id: string): Promise<void>;
  updateAccessPolicy(
    seriesId: string,
    freeVolumeCount: number,
    previewEpisodeCount: number,
  ): Promise<AccessPolicyResponse | null>;
  setEpisodeVisibility(
    episodeId: string,
    visibility: EpisodeVisibility,
  ): Promise<DraftEpisode | null>;
  updateEpisodeTitle(
    episodeId: string,
    title: string,
  ): Promise<DraftEpisode | null>;
  listDraftEpisodes(): Promise<DraftEpisode[]>;
  createPackagingRequest(
    input: CreatePackagingRequestInput,
  ): Promise<PackagingRequest>;
  listPackagingRequests(): Promise<PackagingRequest[]>;
}

export class PrismaStudioRepository implements StudioRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findSeason(id: string): Promise<StudioSeason | null> {
    const season = await this.prisma.season.findUnique({
      where: { id },
      include: { series: true },
    });
    if (!season) return null;
    return {
      id: season.id,
      number: season.number,
      status: season.status,
      series: {
        id: season.series.id,
        slug: season.series.slug,
        title: season.series.title,
      },
    };
  }

  async createEpisode(
    input: CreateStudioEpisodeInput,
  ): Promise<CreatedStudioEpisode> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const episode = await transaction.episode.create({
          data: {
            seasonId: input.seasonId,
            number: input.number,
            title: input.title,
            visibility: input.visibility,
          },
        });
        await transaction.page.createMany({
          data: input.imageUrls.map((imageUrl, index) => ({
            episodeId: episode.id,
            order: index + 1,
            imageUrl,
          })),
        });
        return { id: episode.id };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new StudioRepositoryError("EPISODE_NUMBER_EXISTS");
      }
      throw error;
    }
  }

  async deleteEpisode(id: string): Promise<void> {
    await this.prisma.episode.delete({ where: { id } }).catch(() => undefined);
  }

  async updateAccessPolicy(
    seriesId: string,
    freeVolumeCount: number,
    previewEpisodeCount: number,
  ): Promise<AccessPolicyResponse | null> {
    const updated = await this.prisma.series
      .update({
        where: { id: seriesId },
        data: { freeVolumeCount, previewEpisodeCount },
        select: { id: true, freeVolumeCount: true, previewEpisodeCount: true },
      })
      .catch(() => null);
    return updated
      ? {
          seriesId: updated.id,
          freeVolumeCount: updated.freeVolumeCount,
          previewEpisodeCount: updated.previewEpisodeCount,
        }
      : null;
  }

  async setEpisodeVisibility(
    episodeId: string,
    visibility: EpisodeVisibility,
  ): Promise<DraftEpisode | null> {
    const updated = await this.prisma.episode
      .update({
        where: { id: episodeId },
        data: { visibility },
        include: { season: { include: { series: true } } },
      })
      .catch(() => null);
    return updated ? toDraftEpisode(updated) : null;
  }

  async updateEpisodeTitle(
    episodeId: string,
    title: string,
  ): Promise<DraftEpisode | null> {
    const updated = await this.prisma.episode
      .update({
        where: { id: episodeId },
        data: { title },
        include: { season: { include: { series: true } } },
      })
      .catch(() => null);
    return updated ? toDraftEpisode(updated) : null;
  }

  async listDraftEpisodes(): Promise<DraftEpisode[]> {
    const episodes = await this.prisma.episode.findMany({
      where: { visibility: "private" },
      orderBy: { publishedAt: "desc" },
      include: { season: { include: { series: true } } },
    });
    return episodes.map(toDraftEpisode);
  }

  async createPackagingRequest(
    input: CreatePackagingRequestInput,
  ): Promise<PackagingRequest> {
    const created = await this.prisma.packagingRequest.create({
      data: input,
    });
    return toPackagingRequest(created);
  }

  async listPackagingRequests(): Promise<PackagingRequest[]> {
    const requests = await this.prisma.packagingRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return requests.map(toPackagingRequest);
  }
}

function toDraftEpisode(
  episode: Prisma.EpisodeGetPayload<{
    include: { season: { include: { series: true } } };
  }>,
): DraftEpisode {
  return {
    id: episode.id,
    number: episode.number,
    title: episode.title,
    publishedAt: episode.publishedAt.toISOString(),
    season: {
      id: episode.season.id,
      number: episode.season.number,
    },
    series: {
      slug: episode.season.series.slug,
      title: episode.season.series.title,
    },
  };
}

function toPackagingRequest(
  request: Prisma.PackagingRequestGetPayload<Record<string, never>>,
): PackagingRequest {
  return {
    id: request.id,
    applicantName: request.applicantName,
    bookTitle: request.bookTitle,
    bookSize: request.bookSize === "B5" ? "B5" : "A5",
    coverType:
      request.coverType === "hardcover" ? "hardcover" : "softcover",
    quantity: request.quantity,
    memo: request.memo,
    pageCount: request.pageCount,
    status:
      request.status === "reviewing" ||
      request.status === "completed" ||
      request.status === "canceled"
        ? request.status
        : "received",
    createdAt: request.createdAt.toISOString(),
  };
}
