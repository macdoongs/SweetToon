import { Prisma, PrismaClient } from "@prisma/client";
import type { AccessPolicyResponse } from "../contracts/studio";

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
}
