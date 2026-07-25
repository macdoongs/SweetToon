import request from "supertest";
import { createApp } from "../app";
import type { ReaderRepository } from "../repositories/reader-repository";

const readerRepository = {
  listSeries: jest.fn(),
  findSeriesBySlug: jest.fn(),
  findEpisodeById: jest.fn(),
} as unknown as ReaderRepository;

describe("HTTP security boundary", () => {
  const app = createApp({
    readerRepository,
    allowedOrigins: ["https://sweettoon.example.com"],
  });

  it("adds defensive response headers", async () => {
    const response = await request(app).get("/health").expect(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
  });

  it("allows only configured cross-origin callers", async () => {
    const allowed = await request(app)
      .get("/health")
      .set("Origin", "https://sweettoon.example.com")
      .expect(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://sweettoon.example.com",
    );

    const rejected = await request(app)
      .get("/health")
      .set("Origin", "https://attacker.example")
      .expect(200);
    expect(rejected.headers).not.toHaveProperty(
      "access-control-allow-origin",
    );
  });
});
