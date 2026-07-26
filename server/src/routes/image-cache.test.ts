import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../app";
import type { ReaderRepository } from "../repositories/reader-repository";

function readerRepository(): ReaderRepository {
  return {
    listSeries: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      nextPage: null,
      total: 0,
      facets: { genres: [], weekdays: [] },
    }),
    listRealtimeSeries: jest.fn().mockResolvedValue([]),
    seriesExists: jest.fn().mockResolvedValue(false),
    findSeriesBySlug: jest.fn().mockResolvedValue(null),
    findEpisodeById: jest.fn().mockResolvedValue(null),
  };
}

describe("published image cache policy", () => {
  let uploadDir: string;

  beforeEach(() => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "sweettoon-cache-"));
    fs.mkdirSync(path.join(uploadDir, "studio", "series", "reader"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(uploadDir, "studio", "series", ".original"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(uploadDir, "series"), { recursive: true });
    fs.writeFileSync(
      path.join(uploadDir, "studio", "series", "reader", "001.webp"),
      "published",
    );
    fs.writeFileSync(
      path.join(uploadDir, "studio", "series", ".original", "001.png"),
      "private source",
    );
    fs.writeFileSync(path.join(uploadDir, "series", "cover.webp"), "cover");
  });

  afterEach(() => {
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it("marks UUID publication paths immutable but keeps generic assets mutable", async () => {
    const app = createApp({
      readerRepository: readerRepository(),
      uploadDir,
    });

    const published = await request(app)
      .get("/api/images/studio/series/reader/001.webp")
      .expect(200);
    expect(published.headers["cache-control"]).toContain("max-age=31536000");
    expect(published.headers["cache-control"]).toContain("immutable");
    expect(published.headers["x-content-type-options"]).toBe("nosniff");

    await request(app)
      .get("/api/images/studio/series/.original/001.png")
      .expect(404);

    const cover = await request(app)
      .get("/api/images/series/cover.webp")
      .expect(200);
    expect(cover.headers["cache-control"]).not.toContain("immutable");
  });
});
