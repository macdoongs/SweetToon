import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SitemapDiscoveryResponse } from "@/lib/discovery-types";
import { getSitemapDiscovery } from "@/lib/server-api";
import sitemap from "./sitemap";

vi.mock("@/lib/server-api", () => ({
  getSitemapDiscovery: vi.fn(),
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

const discovery: SitemapDiscoveryResponse = {
  series: [
    {
      slug: "available-series",
      status: "ongoing",
      coverUrl: "/covers/available.webp",
      updatedAt: "2026-07-30T00:00:00.000Z",
    },
  ],
  episodes: [
    {
      id: "episode-1",
      number: 1,
      title: "첫 화",
      publishedAt: "2026-07-26T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:00.000Z",
      series: {
        slug: "available-series",
        title: "정상 작품",
        synopsis: "정상 작품 소개",
        genre: "드라마",
        authorName: "작가",
      },
    },
  ],
};

describe("sitemap", () => {
  beforeEach(() => {
    vi.mocked(getSitemapDiscovery).mockResolvedValue(discovery);
  });

  it("uses the discovery projection without per-series detail requests", async () => {
    const result = await sitemap();

    expect(result).toContainEqual({
      url: "https://sweettoon.example/series/available-series",
      lastModified: "2026-07-30T00:00:00.000Z",
      changeFrequency: "weekly",
      priority: 0.8,
      images: [
        "https://sweettoon.example/covers/available.webp",
      ],
    });
    expect(result).toContainEqual({
      url: "https://sweettoon.example/read/episode-1",
      lastModified: "2026-07-29T00:00:00.000Z",
      changeFrequency: "monthly",
      priority: 0.6,
    });
    expect(getSitemapDiscovery).toHaveBeenCalledOnce();
  });

  it("returns the homepage when discovery data is unavailable", async () => {
    vi.mocked(getSitemapDiscovery).mockRejectedValue(
      new Error("api unavailable"),
    );

    await expect(sitemap()).resolves.toEqual([
      {
        url: "https://sweettoon.example/",
        changeFrequency: "daily",
        priority: 1,
      },
    ]);
  });

  it("omits image metadata for a series without a cover", async () => {
    vi.mocked(getSitemapDiscovery).mockResolvedValue({
      ...discovery,
      series: [
        {
          ...discovery.series[0],
          coverUrl: null,
          status: "completed",
        },
      ],
    });

    const entry = (await sitemap()).find((item) =>
      item.url.includes("/series/"),
    );

    expect(entry).toMatchObject({
      changeFrequency: "monthly",
      images: undefined,
    });
  });
});
