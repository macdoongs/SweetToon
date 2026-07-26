import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  SeriesDetail,
  SeriesListResponse,
} from "@/lib/reader-types";
import { getAllSeries, getSeriesDetail } from "@/lib/server-api";
import sitemap from "./sitemap";

vi.mock("@/lib/server-api", () => ({
  getAllSeries: vi.fn(),
  getSeriesDetail: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache:
    (callback: (...args: never[]) => unknown) =>
    (...args: never[]) =>
      callback(...args),
}));

vi.mock("@/lib/site", () => ({
  absoluteUrl: (path: string) => `https://sweettoon.example${path}`,
}));

const list: SeriesListResponse = {
  items: [
    {
      id: "series-1",
      slug: "available-series",
      title: "정상 작품",
      synopsis: "정상 작품 소개",
      genre: "드라마",
      weekday: "mon",
      freeVolumeCount: 1,
      previewEpisodeCount: 5,
      coverUrl: "/covers/available.webp",
      status: "ongoing",
      author: { name: "작가" },
      episodeCount: 1,
      completedSeasonCount: 0,
      latestEpisode: null,
    },
    {
      id: "series-2",
      slug: "unavailable-series",
      title: "일시 장애 작품",
      synopsis: "일시 장애 작품 소개",
      genre: "판타지",
      weekday: "tue",
      freeVolumeCount: 1,
      previewEpisodeCount: 5,
      coverUrl: null,
      status: "completed",
      author: { name: "작가" },
      episodeCount: 1,
      completedSeasonCount: 1,
      latestEpisode: null,
    },
  ],
  page: 1,
  nextPage: null,
  total: 2,
  facets: { genres: ["드라마", "판타지"], weekdays: ["mon", "tue"] },
};

const availableSeries: SeriesDetail = {
  id: "series-1",
  slug: "available-series",
  title: "정상 작품",
  synopsis: "정상 작품 소개",
  genre: "드라마",
  weekday: "mon",
  freeVolumeCount: 1,
  previewEpisodeCount: 5,
  coverUrl: "/covers/available.webp",
  status: "ongoing",
  author: { name: "작가", bio: null, avatarUrl: null },
  seasons: [
    {
      id: "season-1",
      number: 1,
      title: null,
      status: "ongoing",
      episodes: [
        {
          id: "episode-1",
          number: 1,
          title: "첫 화",
          publishedAt: "2026-07-26T00:00:00.000Z",
          volumeNumber: 1,
          access: "free",
        },
      ],
    },
  ],
};

describe("sitemap", () => {
  beforeEach(() => {
    vi.mocked(getAllSeries).mockResolvedValue(list);
    vi.mocked(getSeriesDetail).mockReset();
  });

  it("keeps successful series when another detail request fails", async () => {
    vi.mocked(getSeriesDetail).mockImplementation((slug) =>
      slug === "available-series"
        ? Promise.resolve(availableSeries)
        : Promise.reject(new Error("temporary failure")),
    );

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).toContain("https://sweettoon.example/");
    expect(urls).toContain(
      "https://sweettoon.example/series/available-series",
    );
    expect(urls).toContain("https://sweettoon.example/read/episode-1");
    expect(urls).not.toContain(
      "https://sweettoon.example/series/unavailable-series",
    );
  });

  it("returns the homepage when the series list itself is unavailable", async () => {
    vi.mocked(getAllSeries).mockRejectedValue(new Error("api unavailable"));

    await expect(sitemap()).resolves.toEqual([
      {
        url: "https://sweettoon.example/",
        changeFrequency: "daily",
        priority: 1,
      },
    ]);
  });

  it("uses the newest publication date when older episodes are backfilled", async () => {
    vi.mocked(getAllSeries).mockResolvedValue({
      ...list,
      items: [list.items[0]],
      total: 1,
    });
    vi.mocked(getSeriesDetail).mockResolvedValue({
      ...availableSeries,
      seasons: [
        {
          ...availableSeries.seasons[0],
          episodes: [
            {
              ...availableSeries.seasons[0].episodes[0],
              publishedAt: "2026-07-30T00:00:00.000Z",
            },
            {
              ...availableSeries.seasons[0].episodes[0],
              id: "episode-2",
              number: 2,
              publishedAt: "2026-07-20T00:00:00.000Z",
            },
          ],
        },
      ],
    });

    const result = await sitemap();

    expect(
      result.find(
        (entry) =>
          entry.url ===
          "https://sweettoon.example/series/available-series",
      )?.lastModified,
    ).toBe("2026-07-30T00:00:00.000Z");
    expect(getSeriesDetail).toHaveBeenCalledWith("available-series", {
      fresh: false,
    });
  });
});
