import { Prisma, type PrismaClient } from "@prisma/client";
import { PrismaStudioRepository } from "./studio-repository";

function repositoryWithSeriesUpdate(
  update: () => Promise<unknown>,
): PrismaStudioRepository {
  return new PrismaStudioRepository({
    series: { update },
  } as unknown as PrismaClient);
}

describe("PrismaStudioRepository error classification", () => {
  it("maps only Prisma not-found updates to null", async () => {
    const repository = repositoryWithSeriesUpdate(() =>
      Promise.reject(
        new Prisma.PrismaClientKnownRequestError("missing", {
          code: "P2025",
          clientVersion: "6.19.3",
        }),
      ),
    );

    await expect(
      repository.updateAccessPolicy("missing", 1, 0),
    ).resolves.toBeNull();
  });

  it("propagates database availability failures", async () => {
    const repository = repositoryWithSeriesUpdate(() =>
      Promise.reject(new Error("database unavailable")),
    );

    await expect(
      repository.updateAccessPolicy("series-1", 1, 0),
    ).rejects.toThrow("database unavailable");
  });
});
