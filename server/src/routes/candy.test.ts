import express from "express";
import request from "supertest";
import type { CandyUseCases } from "../services/candy-service";
import { createCandyRouter } from "./candy";

const walletToken = "e4a40518-b468-4a0a-b51d-309cd07e630c";
const requestKey = "f371de0c-01cd-4214-99f7-7cd8e1df82a0";

function service(): jest.Mocked<CandyUseCases> {
  return {
    getWallet: jest.fn().mockResolvedValue({ balance: 0, unitPrice: 100 }),
    charge: jest.fn().mockResolvedValue({
      balance: 10,
      unitPrice: 100,
      chargedCandy: 10,
      price: 1_000,
      currency: "KRW",
      mock: true,
      charged: true,
    }),
    unlockEpisode: jest.fn(),
  };
}

describe("candy routes", () => {
  it("accepts a fixed mock package and returns its explicit mock result", async () => {
    const useCases = service();
    const app = express();
    app.use(express.json());
    app.use("/api", createCandyRouter(useCases));

    const response = await request(app)
      .post(`/api/candy-wallets/${walletToken}/charges`)
      .send({ requestKey, candyAmount: 10 })
      .expect(200);

    expect(response.body).toMatchObject({
      balance: 10,
      chargedCandy: 10,
      price: 1_000,
      mock: true,
    });
    expect(useCases.charge).toHaveBeenCalledWith(walletToken, {
      requestKey,
      candyAmount: 10,
    });
  });

  it("rejects arbitrary charge amounts", async () => {
    const useCases = service();
    const app = express();
    app.use(express.json());
    app.use("/api", createCandyRouter(useCases));

    await request(app)
      .post(`/api/candy-wallets/${walletToken}/charges`)
      .send({ requestKey, candyAmount: 11 })
      .expect(400);

    expect(useCases.charge).not.toHaveBeenCalled();
  });
});
