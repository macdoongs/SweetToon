import { Prisma, PrismaClient } from "@prisma/client";

export type CandyUnlockResult =
  | { kind: "not_found" }
  | { kind: "free"; balance: number }
  | { kind: "already_unlocked"; balance: number }
  | { kind: "insufficient"; balance: number }
  | { kind: "unlocked"; balance: number };

export interface CandyRepository {
  getBalance(walletToken: string): Promise<number>;
  unlockEpisode(
    walletToken: string,
    episodeId: string,
    requestKey: string,
  ): Promise<CandyUnlockResult>;
}

export class PrismaCandyRepository implements CandyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getBalance(walletToken: string): Promise<number> {
    const wallet = await this.prisma.candyWallet.findUnique({
      where: { token: walletToken },
      select: { balance: true },
    });
    return wallet?.balance ?? 0;
  }

  async unlockEpisode(
    walletToken: string,
    episodeId: string,
    requestKey: string,
  ): Promise<CandyUnlockResult> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const episode = await transaction.episode.findUnique({
          where: { id: episodeId },
          include: { season: { include: { series: true } } },
        });
        if (!episode) return { kind: "not_found" };

        const wallet = await transaction.candyWallet.upsert({
          where: { token: walletToken },
          update: {},
          create: { token: walletToken },
        });
        const isFree =
          episode.number <=
          episode.season.series.freeVolumeCount * 5 +
            episode.season.series.previewEpisodeCount;
        if (isFree) return { kind: "free", balance: wallet.balance };

        const existing = await transaction.candyEpisodeEntitlement.findUnique({
          where: {
            walletToken_episodeId: { walletToken, episodeId },
          },
        });
        if (existing) {
          return { kind: "already_unlocked", balance: wallet.balance };
        }

        const repeatedRequest = await transaction.candyTransaction.findUnique({
          where: { requestKey },
        });
        if (repeatedRequest) {
          return {
            kind:
              repeatedRequest.walletToken === walletToken &&
              repeatedRequest.episodeId === episodeId
                ? "already_unlocked"
                : "insufficient",
            balance: wallet.balance,
          };
        }

        const decremented = await transaction.candyWallet.updateMany({
          where: { token: walletToken, balance: { gte: 1 } },
          data: { balance: { decrement: 1 } },
        });
        if (decremented.count === 0) {
          return { kind: "insufficient", balance: wallet.balance };
        }
        const updatedWallet = await transaction.candyWallet.findUniqueOrThrow({
          where: { token: walletToken },
        });
        await transaction.candyTransaction.create({
          data: {
            walletToken,
            type: "episode_unlock",
            amount: -1,
            balanceAfter: updatedWallet.balance,
            requestKey,
            episodeId,
          },
        });
        await transaction.candyEpisodeEntitlement.create({
          data: { walletToken, episodeId },
        });
        return { kind: "unlocked", balance: updatedWallet.balance };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const entitlement =
          await this.prisma.candyEpisodeEntitlement.findUnique({
            where: {
              walletToken_episodeId: { walletToken, episodeId },
            },
          });
        if (entitlement) {
          return {
            kind: "already_unlocked",
            balance: await this.getBalance(walletToken),
          };
        }
      }
      throw error;
    }
  }
}
