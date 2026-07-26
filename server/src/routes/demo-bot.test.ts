import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../app";
import type { DemoBotController } from "../realtime/demo-bot-service";
import type { ReaderRepository } from "../repositories/reader-repository";

const status = {
  available: true,
  running: true,
  leader: true,
  readerCount: 8,
  activeBotCount: 8,
  speed: "normal" as const,
  tickIntervalSeconds: 8,
  lastTickAt: "2026-07-25T00:00:00.000Z",
  nextTickAt: "2026-07-25T00:00:08.000Z",
  activeOrderId: null,
  lastAction: "가상 독자를 갱신했습니다.",
};

function readerRepository(): ReaderRepository {
  return {
    listSeries: jest.fn(),
    listRealtimeSeriesKeys: jest.fn(),
    listRealtimeSeries: jest.fn(),
    seriesExists: jest.fn(),
    findSeriesBySlug: jest.fn(),
    findEpisodeById: jest.fn(),
  };
}

function controller(): jest.Mocked<DemoBotController> {
  return {
    status: jest.fn().mockReturnValue(status),
    update: jest.fn().mockResolvedValue(status),
    reset: jest.fn().mockResolvedValue(status),
    start: jest.fn(),
    close: jest.fn(),
  };
}

describe("demo bot routes", () => {
  it("exposes status and validates operator changes", async () => {
    const demoBot = controller();
    const app = createApp({
      readerRepository: readerRepository(),
      demoBot,
      uploadDir: path.join(os.tmpdir(), "sweettoon-demo-bot-routes"),
    });

    const current = await request(app)
      .get("/api/realtime/demo-bot")
      .expect(200);
    await request(app)
      .patch("/api/realtime/demo-bot")
      .send({ speed: "fast", readerCount: 12 })
      .expect(200);
    await request(app)
      .patch("/api/realtime/demo-bot")
      .send({ speed: "instant" })
      .expect(400);
    await request(app)
      .post("/api/realtime/demo-bot/reset")
      .send({})
      .expect(200);

    expect(current.body.activeBotCount).toBe(8);
    expect(demoBot.update).toHaveBeenCalledWith({
      speed: "fast",
      readerCount: 12,
    });
    expect(demoBot.reset).toHaveBeenCalledTimes(1);
  });
});
