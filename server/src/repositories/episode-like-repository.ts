import { PrismaClient } from "@prisma/client";

export type EpisodeLikeState = {
  liked: boolean;
  likeCount: number;
};

export interface EpisodeLikeRepository {
  setLiked(
    episodeId: string,
    viewerHash: string,
    liked: boolean,
  ): Promise<EpisodeLikeState | null>;
}

export class PrismaEpisodeLikeRepository implements EpisodeLikeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async setLiked(
    episodeId: string,
    viewerHash: string,
    liked: boolean,
  ): Promise<EpisodeLikeState | null> {
    return this.prisma.$transaction(async (transaction) => {
      const episode = await transaction.episode.findFirst({
        where: { id: episodeId, visibility: "public" },
        select: { likeCount: true },
      });
      if (!episode) return null;

      if (liked) {
        const inserted = await transaction.episodeLike.createMany({
          data: [{ episodeId, viewerHash }],
          skipDuplicates: true,
        });
        const current = inserted.count
          ? await transaction.episode.update({
              where: { id: episodeId },
              data: { likeCount: { increment: 1 } },
              select: { likeCount: true },
            })
          : await transaction.episode.findUniqueOrThrow({
              where: { id: episodeId },
              select: { likeCount: true },
            });
        return { liked: true, likeCount: current.likeCount };
      }

      const removed = await transaction.episodeLike.deleteMany({
        where: { episodeId, viewerHash },
      });
      if (removed.count) {
        await transaction.episode.updateMany({
          where: { id: episodeId, likeCount: { gt: 0 } },
          data: { likeCount: { decrement: 1 } },
        });
      }
      const current = await transaction.episode.findUniqueOrThrow({
        where: { id: episodeId },
        select: { likeCount: true },
      });
      return { liked: false, likeCount: current.likeCount };
    });
  }
}
