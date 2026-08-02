import { describe, expect, it } from "vitest";
import type { FavoriteSeries } from "./favorites";
import type { ReadingProgress } from "./reading-progress";
import type { SeriesSummary } from "./reader-types";
import { buildRecommendationShelves } from "./recommendations";

function series(
  slug: string,
  genre: string,
  authorName = "작가",
): SeriesSummary {
  return {
    id: slug,
    slug,
    title: slug,
    synopsis: `${slug} 이야기`,
    genre,
    weekday: "mon",
    freeVolumeCount: 1,
    previewEpisodeCount: 0,
    coverUrl: `/covers/${slug}.webp`,
    status: "ongoing",
    author: { name: authorName },
    episodeCount: 30,
    completedSeasonCount: 0,
    latestEpisode: null,
  };
}

describe("buildRecommendationShelves", () => {
  it("찜한 작품과 이미 읽은 작품을 제외하고 찜 취향을 우선한다", () => {
    const catalog = [
      series("liked", "힐링 판타지", "마음"),
      series("read", "액션"),
      series("fantasy", "판타지"),
      series("same-author", "일상", "마음"),
      series("action-a", "액션"),
      series("action-b", "액션"),
    ];
    const favorites: FavoriteSeries[] = [
      {
        slug: "liked",
        title: "좋아한 작품",
        synopsis: "",
        genre: "힐링 판타지",
        coverUrl: null,
        authorName: "마음",
        addedAt: "2026-07-25T10:00:00.000Z",
      },
    ];
    const progress: Record<string, ReadingProgress> = {
      episode: {
        seriesSlug: "read",
        episodeId: "episode",
        episodeNumber: 1,
        episodeTitle: "시작",
        pageOrder: 1,
        percent: 50,
        completed: false,
        updatedAt: "2026-07-25T11:00:00.000Z",
      },
    };

    const shelves = buildRecommendationShelves(
      catalog,
      favorites,
      progress,
    );

    expect(shelves[0].title).toContain("좋아한 작품");
    expect(shelves[0].items[0].slug).toBe("fantasy");
    expect(shelves[0].items).toHaveLength(4);
    expect(shelves.flatMap((shelf) => shelf.items)).not.toContainEqual(
      expect.objectContaining({ slug: "liked" }),
    );
    expect(shelves.flatMap((shelf) => shelf.items)).not.toContainEqual(
      expect.objectContaining({ slug: "read" }),
    );
  });

  it("취향 기록이 없으면 장르별 발견 레일을 만든다", () => {
    const catalog = [
      series("fantasy-a", "판타지"),
      series("fantasy-b", "판타지"),
      series("mystery-a", "미스터리"),
      series("mystery-b", "미스터리"),
      series("romance-a", "로맨스"),
      series("romance-b", "로맨스"),
      series("daily-a", "일상"),
      series("daily-b", "일상"),
      series("action-a", "액션"),
      series("action-b", "액션"),
      series("sports-a", "스포츠"),
      series("sports-b", "스포츠"),
    ];

    const shelves = buildRecommendationShelves(catalog, [], {});

    expect(shelves).toHaveLength(3);
    expect(shelves.every((shelf) => shelf.items.length === 4)).toBe(true);
    expect(shelves.map((shelf) => shelf.title)).toEqual([
      "새로운 세계와 수수께끼",
      "설렘과 다정한 하루",
      "속도감과 뜨거운 승부",
    ]);
  });

  it("개인화와 장르 선반 사이에서 같은 작품을 반복하지 않는다", () => {
    const catalog = [
      series("liked", "힐링 판타지"),
      ...Array.from({ length: 12 }, (_, index) =>
        series(`fantasy-${index + 1}`, "판타지"),
      ),
    ];
    const favorites: FavoriteSeries[] = [
      {
        slug: "liked",
        title: "좋아한 작품",
        synopsis: "",
        genre: "힐링 판타지",
        coverUrl: null,
        authorName: "작가",
        addedAt: "2026-07-31T10:00:00.000Z",
      },
    ];

    const shelves = buildRecommendationShelves(catalog, favorites, {});
    const recommendedSlugs = shelves.flatMap((shelf) =>
      shelf.items.map((item) => item.slug),
    );

    expect(shelves).toHaveLength(2);
    expect(shelves[0].items).toHaveLength(8);
    expect(shelves[1].eyebrow).toBe("Explore by genre");
    expect(new Set(recommendedSlugs).size).toBe(recommendedSlugs.length);
  });
});
