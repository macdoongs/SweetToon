import request from "supertest";
import { createApp } from "../app";
import type { ReaderRepository } from "../repositories/reader-repository";

const readerRepository = {
  listSeries: jest.fn(),
  listRealtimeSeriesKeys: jest.fn(),
  listRealtimeSeries: jest.fn(),
  seriesExists: jest.fn(),
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
    expect(response.headers).toHaveProperty("content-security-policy");
  });

  it("separates liveness from dependency readiness", async () => {
    const errorLog = jest.spyOn(console, "error").mockImplementation();
    const readinessCheck = jest
      .fn<Promise<void>, []>()
      .mockRejectedValue(new Error("database unavailable"));
    const checkedApp = createApp({
      readerRepository,
      readinessCheck,
    });

    await request(checkedApp).get("/health/live").expect(200);
    const unavailable = await request(checkedApp)
      .get("/health/ready")
      .expect(503);

    expect(unavailable.body).toEqual(
      expect.objectContaining({
        ok: false,
        dependencies: "unavailable",
      }),
    );
    expect(readinessCheck).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledWith(
      "[sweettoon-readiness]",
      expect.any(Error),
    );
    errorLog.mockRestore();
  });

  it("relaxes CSP only for the inline Swagger bootstrap", async () => {
    const docs = await request(app).get("/api-docs/").expect(200);
    const api = await request(app).get("/openapi.json").expect(200);

    expect(docs.headers).not.toHaveProperty("content-security-policy");
    expect(api.headers).toHaveProperty("content-security-policy");
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

  it("returns the stable JSON contract for unknown APIs", async () => {
    const response = await request(app).get("/api/missing").expect(404);

    expect(response.body).toEqual({
      code: "API_NOT_FOUND",
      message: "요청한 API를 찾을 수 없습니다.",
    });
    expect(response.type).toBe("application/json");
  });

  it("returns a client error for malformed JSON", async () => {
    const response = await request(app)
      .post("/api/anything")
      .set("Content-Type", "application/json")
      .send('{"broken":')
      .expect(400);

    expect(response.body).toEqual({
      code: "INVALID_JSON",
      message: "JSON 요청 본문이 올바르지 않습니다.",
    });
  });
});
