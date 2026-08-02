import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecentEpisodesResponse } from "@/lib/discovery-types";
import { getRecentEpisodes } from "@/lib/server-api";
import { GET } from "./route";

vi.mock("@/lib/server-api", () => ({
  getRecentEpisodes: vi.fn(),
}));

vi.mock("@/lib/site", () => ({
  absoluteUrl: (path: string) => `https://sweettoon.example${path}`,
  SITE_DESCRIPTION: "달콤한 작품 & 소장 경험",
  SITE_NAME: "Sweet <Toon>",
}));

const recentEpisodes: RecentEpisodesResponse = {
  items: [
    {
      id: "episode-2",
      number: 2,
      title: "다음 & 이야기",
      publishedAt: "2026-07-27T00:00:00.000Z",
      updatedAt: "2026-07-27T01:00:00.000Z",
      series: {
        slug: "series",
        title: "작품 <둘>",
        synopsis: "소개 & 설명",
        genre: "드라마",
        authorName: "작가 <B>",
      },
    },
    {
      id: "episode-1",
      number: 1,
      title: "첫 이야기",
      publishedAt: "2026-07-26T00:00:00.000Z",
      updatedAt: "2026-07-26T01:00:00.000Z",
      series: {
        slug: "series",
        title: "작품 <둘>",
        synopsis: "소개 & 설명",
        genre: "드라마",
        authorName: "작가 <B>",
      },
    },
  ],
};

describe("RSS feed", () => {
  beforeEach(() => {
    vi.mocked(getRecentEpisodes).mockResolvedValue(recentEpisodes);
  });

  it("publishes globally recent episodes with RSS-safe creator metadata", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(getRecentEpisodes).toHaveBeenCalledWith(50);
    expect(xml).toContain(
      'xmlns:dc="http://purl.org/dc/elements/1.1/"',
    );
    expect(xml).toContain(
      "<title>작품 &lt;둘&gt; 2화 — 다음 &amp; 이야기</title>",
    );
    expect(xml).toContain("<dc:creator>작가 &lt;B&gt;</dc:creator>");
    expect(xml).not.toContain("<author>");
    expect(xml.indexOf("/read/episode-2")).toBeLessThan(
      xml.indexOf("/read/episode-1"),
    );
    expect(xml).toContain(
      "<lastBuildDate>Mon, 27 Jul 2026 00:00:00 GMT</lastBuildDate>",
    );
  });

  it("sets feed discovery and shared-cache headers", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(response.headers.get("content-type")).toBe(
      "application/rss+xml; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toContain(
      "s-maxage=300",
    );
    expect(xml).toContain(
      '<atom:link href="https://sweettoon.example/feed.xml" rel="self" type="application/rss+xml" />',
    );
  });
});
