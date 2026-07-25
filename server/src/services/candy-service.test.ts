import type { CandyRepository } from "../repositories/candy-repository";
import { CandyService, CandyServiceError } from "./candy-service";

const walletToken = "e4a40518-b468-4a0a-b51d-309cd07e630c";
const requestKey = "f371de0c-01cd-4214-99f7-7cd8e1df82a0";

function makeRepository(): jest.Mocked<CandyRepository> {
  return {
    getBalance: jest.fn().mockResolvedValue(5),
    charge: jest.fn(),
    unlockEpisode: jest.fn(),
  };
}

describe("CandyService", () => {
  it("returns a browser wallet balance with the fixed 100 won unit price", async () => {
    const repository = makeRepository();
    const service = new CandyService(repository);

    await expect(service.getWallet(walletToken)).resolves.toEqual({
      balance: 5,
      unitPrice: 100,
    });
  });

  it("adds a fixed mock charge package at 100 won per candy", async () => {
    const repository = makeRepository();
    repository.charge.mockResolvedValue({ kind: "charged", balance: 15 });
    const service = new CandyService(repository);

    await expect(
      service.charge(walletToken, { requestKey, candyAmount: 10 }),
    ).resolves.toEqual({
      balance: 15,
      unitPrice: 100,
      chargedCandy: 10,
      price: 1_000,
      currency: "KRW",
      mock: true,
      charged: true,
    });
  });

  it("returns the same balance without a second credit for a repeated charge", async () => {
    const repository = makeRepository();
    repository.charge.mockResolvedValue({
      kind: "already_charged",
      balance: 15,
    });
    const service = new CandyService(repository);

    await expect(
      service.charge(walletToken, { requestKey, candyAmount: 10 }),
    ).resolves.toMatchObject({ balance: 15, charged: false, mock: true });
  });

  it("spends one candy exactly when the repository creates an entitlement", async () => {
    const repository = makeRepository();
    repository.unlockEpisode.mockResolvedValue({
      kind: "unlocked",
      balance: 4,
    });
    const service = new CandyService(repository);

    await expect(
      service.unlockEpisode("episode-6", { walletToken, requestKey }),
    ).resolves.toEqual({
      balance: 4,
      unitPrice: 100,
      episodeId: "episode-6",
      spent: true,
    });
  });

  it("does not report a second charge for an already unlocked episode", async () => {
    const repository = makeRepository();
    repository.unlockEpisode.mockResolvedValue({
      kind: "already_unlocked",
      balance: 4,
    });
    const service = new CandyService(repository);

    await expect(
      service.unlockEpisode("episode-6", { walletToken, requestKey }),
    ).resolves.toMatchObject({ balance: 4, spent: false });
  });

  it("returns a stable domain error when the wallet has no candy", async () => {
    const repository = makeRepository();
    repository.unlockEpisode.mockResolvedValue({
      kind: "insufficient",
      balance: 0,
    });
    const service = new CandyService(repository);

    await expect(
      service.unlockEpisode("episode-6", { walletToken, requestKey }),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_CANDY",
      status: 409,
    } satisfies Partial<CandyServiceError>);
  });
});
