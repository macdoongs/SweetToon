import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../app";
import type {
  EpisodeReader,
  SeriesDetail,
  SeriesListResponse,
} from "../contracts/reader";
import type { ReaderRepository } from "../repositories/reader-repository";

const publishedAt = "2026-07-20T00:00:00.000Z";

const seriesList: SeriesListResponse = {
  items: [
    {
      id: "series-1",
      slug: "moonlight-laundry",
      title: "달빛 세탁소",
      synopsis: "얼룩진 기억을 맡기는 밤의 세탁소",
      genre: "힐링 판타지",
      weekday: "mon",
      freeVolumeCount: 0,
      previewEpisodeCount: 3,
      coverUrl: "/api/images/moonlight-laundry/cover.svg",
      status: "ongoing",
      author: { name: "이수달" },
      episodeCount: 11,
      completedSeasonCount: 1,
      latestEpisode: {
        id: "episode-1",
        number: 1,
        title: "1화",
        publishedAt,
        volumeNumber: 1,
        access: "free",
      },
    },
  ],
  page: 1,
  nextPage: null,
  total: 1,
  facets: { genres: ["힐링 판타지"], weekdays: ["mon"] },
};

const seriesDetail: SeriesDetail = {
  id: "series-1",
  slug: "moonlight-laundry",
  title: "달빛 세탁소",
  synopsis: "얼룩진 기억을 맡기는 밤의 세탁소",
  genre: "힐링 판타지",
  weekday: "mon",
  freeVolumeCount: 0,
  previewEpisodeCount: 3,
  coverUrl: "/api/images/moonlight-laundry/cover.svg",
  status: "ongoing",
  author: {
    name: "이수달",
    bio: "밤 산책과 빨래 개는 시간을 좋아합니다.",
    avatarUrl: null,
  },
  seasons: [
    {
      id: "season-1",
      number: 1,
      title: "얼룩의 계절",
      status: "completed",
      episodes: [
        {
          id: "episode-1",
          number: 1,
          title: "1화",
          publishedAt,
          volumeNumber: 1,
          access: "free",
        },
      ],
    },
  ],
};

const episode: EpisodeReader = {
  id: "episode-1",
  number: 1,
  title: "1화",
  visibility: "public",
  publishedAt,
  likeCount: 0,
  series: {
    id: "series-1",
    slug: "moonlight-laundry",
    title: "달빛 세탁소",
  },
  season: {
    id: "season-1",
    number: 1,
    title: "얼룩의 계절",
    status: "completed",
  },
  pages: [
    { id: "page-1", order: 1, imageUrl: "/api/images/page-1.svg" },
    { id: "page-2", order: 2, imageUrl: "/api/images/page-2.svg" },
  ],
  access: {
    state: "free",
    volumeNumber: 1,
    freeVolumeCount: 0,
    previewEpisodeCount: 3,
  },
  navigation: {
    previousEpisodeId: null,
    nextEpisodeId: "episode-2",
    nextEpisodeSeasonNumber: 1,
  },
};

function makeRepository(): jest.Mocked<ReaderRepository> {
  return {
    listSeries: jest.fn().mockResolvedValue(seriesList),
    listRealtimeSeriesKeys: jest
      .fn()
      .mockResolvedValue(
        seriesList.items.map(({ slug, title }) => ({ slug, title })),
      ),
    listRealtimeSeries: jest.fn().mockResolvedValue(seriesList.items),
    seriesExists: jest
      .fn()
      .mockImplementation(async (slug) => slug === seriesDetail.slug),
    findSeriesBySlug: jest
      .fn()
      .mockImplementation(async (slug) =>
        slug === seriesDetail.slug ? seriesDetail : null,
      ),
    findEpisodeById: jest
      .fn()
      .mockImplementation(async (id) => (id === episode.id ? episode : null)),
    listSitemapDiscovery: jest.fn().mockResolvedValue({
      series: [
        {
          slug: seriesDetail.slug,
          status: "ongoing",
          coverUrl: seriesDetail.coverUrl,
          updatedAt: "2026-07-27T10:00:00.000Z",
        },
      ],
      episodes: [
        {
          id: episode.id,
          number: episode.number,
          title: episode.title,
          publishedAt,
          updatedAt: "2026-07-27T10:00:00.000Z",
          series: {
            slug: seriesDetail.slug,
            title: seriesDetail.title,
            synopsis: seriesDetail.synopsis,
            genre: seriesDetail.genre,
            authorName: seriesDetail.author.name,
          },
        },
      ],
    }),
    listRecentEpisodes: jest.fn().mockResolvedValue([]),
    listShortsPreviews: jest.fn().mockResolvedValue([
      {
        series: {
          slug: seriesDetail.slug,
          title: seriesDetail.title,
          synopsis: seriesDetail.synopsis,
          genre: seriesDetail.genre,
          coverUrl: seriesDetail.coverUrl,
          authorName: seriesDetail.author.name,
        },
        episode: {
          id: episode.id,
          number: episode.number,
          title: episode.title,
          likeCount: episode.likeCount,
        },
        pages: episode.pages,
      },
    ]),
  };
}

function makeApp() {
  return createApp({
    readerRepository: makeRepository(),
    uploadDir: path.join(os.tmpdir(), "sweettoon-reader-tests"),
  });
}

describe("reader routes", () => {
  it("returns the discoverable series list", async () => {
    const repository = makeRepository();
    const app = createApp({
      readerRepository: repository,
      uploadDir: path.join(os.tmpdir(), "sweettoon-reader-tests"),
    });
    const response = await request(app)
      .get("/api/series?filter=collectible")
      .expect(200);

    expect(response.body.items[0].slug).toBe("moonlight-laundry");
    expect(response.body.items[0].episodeCount).toBe(11);
    expect(repository.listSeries).toHaveBeenCalledWith({
      filter: "collectible",
      page: 1,
      pageSize: 12,
    });
  });

  it("rejects an unknown series filter", async () => {
    const response = await request(makeApp())
      .get("/api/series?filter=weekday")
      .expect(400);

    expect(response.body.code).toBe("INVALID_SERIES_FILTER");
  });

  it("accepts a larger page for summary-only recommendation reads", async () => {
    const repository = makeRepository();
    const app = createApp({
      readerRepository: repository,
      uploadDir: path.join(os.tmpdir(), "sweettoon-reader-tests"),
    });

    await request(app).get("/api/series?pageSize=100").expect(200);

    expect(repository.listSeries).toHaveBeenCalledWith({
      filter: "all",
      page: 1,
      pageSize: 100,
    });
  });

  it("returns a series with seasons and episodes", async () => {
    const response = await request(makeApp())
      .get("/api/series/moonlight-laundry")
      .expect(200);

    expect(response.body.seasons[0].status).toBe("completed");
    expect(response.body.seasons[0].episodes[0].id).toBe("episode-1");
  });

  it("rejects malformed slugs with a user-facing error", async () => {
    const response = await request(makeApp())
      .get("/api/series/NOT_VALID")
      .expect(400);

    expect(response.body.code).toBe("INVALID_SERIES_SLUG");
  });

  it("returns a clear 404 when a series does not exist", async () => {
    const response = await request(makeApp())
      .get("/api/series/missing-series")
      .expect(404);

    expect(response.body.code).toBe("SERIES_NOT_FOUND");
  });

  it("returns ordered pages and episode navigation", async () => {
    const response = await request(makeApp())
      .get("/api/episodes/episode-1")
      .expect(200);

    expect(
      response.body.pages.map((page: { order: number }) => page.order),
    ).toEqual([1, 2]);
    expect(response.body.navigation.nextEpisodeId).toBe("episode-2");
    expect(response.body.navigation.nextEpisodeSeasonNumber).toBe(1);
  });

  it("returns public sitemap discovery data", async () => {
    const response = await request(makeApp())
      .get("/api/discovery/sitemap")
      .expect(200);

    expect(response.body.series[0].slug).toBe("moonlight-laundry");
    expect(response.body.episodes[0].updatedAt).toBe(
      "2026-07-27T10:00:00.000Z",
    );
  });

  it("limits the global recent episode feed", async () => {
    const repository = makeRepository();
    const app = createApp({
      readerRepository: repository,
      uploadDir: path.join(os.tmpdir(), "sweettoon-reader-tests"),
    });

    await request(app)
      .get("/api/discovery/recent-episodes?limit=30")
      .expect(200);

    expect(repository.listRecentEpisodes).toHaveBeenCalledWith(30);
    await request(app)
      .get("/api/discovery/recent-episodes?limit=51")
      .expect(400);
  });

  it("returns only the requested number of shorts preview bundles", async () => {
    const repository = makeRepository();
    const app = createApp({
      readerRepository: repository,
      uploadDir: path.join(os.tmpdir(), "sweettoon-reader-tests"),
    });

    const response = await request(app)
      .get("/api/discovery/shorts?limit=6")
      .expect(200);

    expect(repository.listShortsPreviews).toHaveBeenCalledWith(6);
    expect(response.body.items[0].pages).toHaveLength(2);
    expect(response.headers["cache-control"]).toContain("private");

    const invalid = await request(app)
      .get("/api/discovery/shorts?limit=21")
      .expect(400);
    expect(invalid.body.code).toBe("INVALID_SHORTS_LIMIT");
  });

  it("passes an anonymous demo entitlement to the repository", async () => {
    const repository = makeRepository();
    const app = createApp({
      readerRepository: repository,
      uploadDir: path.join(os.tmpdir(), "sweettoon-reader-tests"),
    });

    await request(app)
      .get("/api/episodes/episode-1")
      .set("Authorization", "Bearer private-demo-token")
      .expect(200);

    expect(repository.findEpisodeById).toHaveBeenCalledWith(
      "episode-1",
      "private-demo-token",
    );
  });
});
