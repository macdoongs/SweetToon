import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../app";
import type {
  SeriesDetail,
  SeriesListResponse,
} from "../contracts/reader";
import type { ReaderRepository } from "../repositories/reader-repository";
import { InMemoryRealtimeService } from "../realtime/realtime-service";

const publishedAt = "2026-07-20T00:00:00.000Z";
const summary: SeriesListResponse["items"][number] = {
  id: "series-1",
  slug: "moonlight-laundry",
  title: "달빛 세탁소",
  synopsis: "얼룩진 기억을 맡기는 밤의 세탁소",
  genre: "힐링 판타지",
  weekday: "mon",
  freeVolumeCount: 1,
  previewEpisodeCount: 0,
  coverUrl: null,
  status: "ongoing",
  author: { name: "이수달" },
  episodeCount: 1,
  completedSeasonCount: 1,
  latestEpisode: {
    id: "episode-1",
    number: 1,
    title: "첫 세탁",
    publishedAt,
    volumeNumber: 1,
    access: "free",
  },
};
const detail: SeriesDetail = {
  ...summary,
  author: { ...summary.author, bio: null, avatarUrl: null },
  seasons: [],
};
delete (detail as Partial<typeof summary>).episodeCount;
delete (detail as Partial<typeof summary>).completedSeasonCount;
delete (detail as Partial<typeof summary>).latestEpisode;

function repository(): ReaderRepository {
  return {
    listSeries: jest.fn().mockResolvedValue({
      items: [summary],
      page: 1,
      nextPage: null,
      total: 1,
      facets: { genres: [summary.genre], weekdays: [summary.weekday] },
    }),
    listRealtimeSeriesKeys: jest
      .fn()
      .mockResolvedValue([{ slug: summary.slug, title: summary.title }]),
    listRealtimeSeries: jest.fn().mockResolvedValue([summary]),
    seriesExists: jest
      .fn()
      .mockImplementation(async (slug) => slug === summary.slug),
    findSeriesBySlug: jest
      .fn()
      .mockImplementation(async (slug) => (slug === summary.slug ? detail : null)),
    findEpisodeById: jest.fn().mockResolvedValue(null),
    listSitemapDiscovery: jest
      .fn()
      .mockResolvedValue({ series: [], episodes: [] }),
    listRecentEpisodes: jest.fn().mockResolvedValue([]),
  };
}

describe("realtime routes", () => {
  it("records unique reader presence and ranks active series", async () => {
    const realtime = new InMemoryRealtimeService();
    const readerRepository = repository();
    const app = createApp({
      readerRepository,
      realtime,
      uploadDir: path.join(os.tmpdir(), "sweettoon-realtime-tests"),
    });

    const heartbeat = await request(app)
      .post("/api/series/moonlight-laundry/presence")
      .send({ sessionId: "29b85239-33d3-4789-89ad-a5785f947e6b" })
      .expect(200);
    const popular = await request(app)
      .get("/api/realtime/popular")
      .expect(200);
    const cachedPopular = await request(app)
      .get("/api/realtime/popular")
      .expect(200);

    expect(heartbeat.body.viewerCount).toBe(1);
    expect(popular.body.items).toEqual([
      expect.objectContaining({
        viewerCount: 1,
        series: expect.objectContaining({ slug: "moonlight-laundry" }),
      }),
    ]);
    expect(cachedPopular.body).toEqual(popular.body);
    expect(readerRepository.seriesExists).toHaveBeenCalledWith(
      "moonlight-laundry",
    );
    expect(readerRepository.listRealtimeSeriesKeys).toHaveBeenCalledTimes(1);
    expect(readerRepository.listRealtimeSeries).toHaveBeenCalledWith([
      summary.slug,
    ]);
    expect(readerRepository.findSeriesBySlug).not.toHaveBeenCalled();
    expect(readerRepository.listSeries).not.toHaveBeenCalled();
  });

  it("invalidates a cached empty ranking after a reader heartbeat", async () => {
    const realtime = new InMemoryRealtimeService();
    const readerRepository = repository();
    const app = createApp({
      readerRepository,
      realtime,
      uploadDir: path.join(os.tmpdir(), "sweettoon-realtime-cache-tests"),
    });

    const empty = await request(app).get("/api/realtime/popular").expect(200);
    expect(empty.body.items).toEqual([]);

    await request(app)
      .post("/api/series/moonlight-laundry/presence")
      .send({ sessionId: "39b85239-33d3-4789-89ad-a5785f947e6b" })
      .expect(200);

    const refreshed = await request(app)
      .get("/api/realtime/popular")
      .expect(200);
    expect(refreshed.body.items).toEqual([
      expect.objectContaining({
        viewerCount: 1,
        series: expect.objectContaining({ slug: "moonlight-laundry" }),
      }),
    ]);
    expect(readerRepository.listRealtimeSeriesKeys).toHaveBeenCalledTimes(2);
  });

  it("keeps the popular cache for repeat heartbeats in an active series", async () => {
    const realtime = new InMemoryRealtimeService();
    const readerRepository = repository();
    const app = createApp({
      readerRepository,
      realtime,
      uploadDir: path.join(os.tmpdir(), "sweettoon-realtime-cache-hit-tests"),
    });

    await request(app)
      .post("/api/series/moonlight-laundry/presence")
      .send({ sessionId: "49b85239-33d3-4789-89ad-a5785f947e6b" })
      .expect(200);
    const first = await request(app).get("/api/realtime/popular").expect(200);

    await request(app)
      .post("/api/series/moonlight-laundry/presence")
      .send({ sessionId: "59b85239-33d3-4789-89ad-a5785f947e6b" })
      .expect(200);
    const cached = await request(app).get("/api/realtime/popular").expect(200);

    expect(cached.body).toEqual(first.body);
    expect(readerRepository.listRealtimeSeriesKeys).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed or unknown reader presence", async () => {
    const app = createApp({
      readerRepository: repository(),
      realtime: new InMemoryRealtimeService(),
      uploadDir: path.join(os.tmpdir(), "sweettoon-realtime-tests"),
    });

    await request(app)
      .post("/api/series/moonlight-laundry/presence")
      .send({ sessionId: "not-a-uuid" })
      .expect(400);
    await request(app)
      .post("/api/series/missing-series/presence")
      .send({ sessionId: "29b85239-33d3-4789-89ad-a5785f947e6b" })
      .expect(404);
  });

  it("limits excessive presence heartbeats from one client", async () => {
    const app = createApp({
      readerRepository: repository(),
      realtime: new InMemoryRealtimeService(),
      uploadDir: path.join(os.tmpdir(), "sweettoon-realtime-rate-tests"),
    });

    for (let index = 0; index < 60; index += 1) {
      await request(app)
        .post("/api/series/moonlight-laundry/presence")
        .send({ sessionId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}` })
        .expect(200);
    }
    const limited = await request(app)
      .post("/api/series/moonlight-laundry/presence")
      .send({ sessionId: "00000000-0000-4000-8000-999999999999" })
      .expect(429);

    expect(limited.body.code).toBe("PRESENCE_RATE_LIMITED");
  });
});
