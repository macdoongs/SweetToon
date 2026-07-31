import type { FavoriteSeries } from "./favorites";
import type { ReadingProgress } from "./reading-progress";
import type { SeriesSummary } from "./reader-types";

export type RecommendationSeries = Pick<
  SeriesSummary,
  "id" | "slug" | "title" | "genre" | "coverUrl" | "status" | "author"
>;

export type RecommendationShelf = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  items: RecommendationSeries[];
};

const genreCopy: Record<string, string> = {
  판타지: "새로운 세계로 떠나는 이야기",
  로맨스: "설렘이 오래 남는 이야기",
  일상: "평범한 하루를 다정하게 바꾸는 이야기",
  액션: "멈출 수 없는 속도감의 이야기",
  미스터리: "다음 장면을 추리하게 되는 이야기",
  스포츠: "함께 뛰고 응원하고 싶은 이야기",
};

const discoveryGroups = [
  {
    id: "worlds-and-mysteries",
    eyebrow: "Worlds & mysteries",
    title: "새로운 세계와 수수께끼",
    description: "판타지와 미스터리 작품을 함께 둘러보세요.",
    genres: ["판타지", "미스터리"],
  },
  {
    id: "romance-and-daily-life",
    eyebrow: "Romance & daily life",
    title: "설렘과 다정한 하루",
    description: "로맨스와 일상 작품을 한 레일에 모았어요.",
    genres: ["로맨스", "일상"],
  },
  {
    id: "action-and-sports",
    eyebrow: "Action & sports",
    title: "속도감과 뜨거운 승부",
    description: "액션과 스포츠 작품을 이어서 만나보세요.",
    genres: ["액션", "스포츠"],
  },
] as const;

function genreTokens(genre: string) {
  return new Set(
    genre
      .toLocaleLowerCase("ko-KR")
      .split(/[\s·,/]+/)
      .filter(Boolean),
  );
}

function genreAffinity(left: string, right: string) {
  if (left === right) return 1;
  const leftTokens = genreTokens(left);
  const rightTokens = genreTokens(right);
  const overlap = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  ).length;
  return overlap / Math.max(leftTokens.size, rightTokens.size, 1);
}

function byCoverThenTitle(
  left: RecommendationSeries,
  right: RecommendationSeries,
) {
  if (Boolean(left.coverUrl) !== Boolean(right.coverUrl)) {
    return left.coverUrl ? -1 : 1;
  }
  return left.title.localeCompare(right.title, "ko-KR");
}

function recommendationScore(
  candidate: RecommendationSeries,
  favoriteSeeds: FavoriteSeries[],
  readingSeeds: RecommendationSeries[],
) {
  const favoriteScore = favoriteSeeds.reduce((score, seed) => {
    const affinity = genreAffinity(candidate.genre, seed.genre);
    return (
      score +
      affinity * 12 +
      (candidate.author.name === seed.authorName ? 5 : 0)
    );
  }, 0);
  const readingScore = readingSeeds.reduce(
    (score, seed) => score + genreAffinity(candidate.genre, seed.genre) * 7,
    0,
  );
  return favoriteScore + readingScore + (candidate.coverUrl ? 0.5 : 0);
}

function personalizedShelf(
  candidates: RecommendationSeries[],
  favoriteSeeds: FavoriteSeries[],
  readingSeeds: RecommendationSeries[],
): RecommendationShelf | null {
  const latestFavorite = [...favoriteSeeds].sort(
    (left, right) => Date.parse(right.addedAt) - Date.parse(left.addedAt),
  )[0];
  const latestRead = readingSeeds[0];
  const anchorGenre = latestFavorite?.genre ?? latestRead?.genre;
  if (!anchorGenre) return null;

  const ranked = candidates
    .map((series) => ({
      series,
      score: recommendationScore(series, favoriteSeeds, readingSeeds),
      anchorAffinity: genreAffinity(series.genre, anchorGenre),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.anchorAffinity - left.anchorAffinity ||
        right.score - left.score ||
        byCoverThenTitle(left.series, right.series),
    )
    .slice(0, 8)
    .map(({ series }) => series);

  if (!ranked.length) return null;
  const anchorTitle = latestFavorite?.title ?? latestRead?.title;
  return {
    id: "for-you",
    eyebrow: "Because you liked",
    title: latestFavorite
      ? `〈${anchorTitle}〉을 찜한 당신을 위해`
      : `〈${anchorTitle}〉을 읽은 당신을 위해`,
    description: `${anchorGenre} 취향과 가까운 작품부터 먼저 보여드려요.`,
    items: ranked,
  };
}

function genreShelves(
  candidates: RecommendationSeries[],
  preferredGenres: string[],
  limit: number,
  initiallyUsedSlugs: ReadonlySet<string> = new Set(),
) {
  const catalogGenres = [...new Set(candidates.map((series) => series.genre))];
  const orderedGenres = [
    ...preferredGenres,
    ...catalogGenres.sort((left, right) =>
      left.localeCompare(right, "ko-KR"),
    ),
  ].filter(
    (genre, index, genres) =>
      genres.indexOf(genre) === index &&
      candidates.some(
        (series) => genreAffinity(series.genre, genre) > 0,
      ),
  );

  const usedSlugs = new Set(initiallyUsedSlugs);
  const shelves: RecommendationShelf[] = [];

  for (const genre of orderedGenres) {
    const items = candidates
      .filter((series) => !usedSlugs.has(series.slug))
      .map((series) => ({
        series,
        affinity: genreAffinity(series.genre, genre),
      }))
      .filter(({ affinity }) => affinity > 0)
      .sort(
        (left, right) =>
          right.affinity - left.affinity ||
          byCoverThenTitle(left.series, right.series),
      )
      .slice(0, 8)
      .map(({ series }) => series);
    if (items.length < 2) continue;

    const baseGenre =
      genreTokens(genre).size > 1
        ? [...genreTokens(genre)].at(-1) ?? genre
        : genre;
    shelves.push({
      id: `genre-${encodeURIComponent(genre)}`,
      eyebrow: "Explore by genre",
      title: genreCopy[genre] ?? genreCopy[baseGenre] ?? `${genre} 추천`,
      description: `${genre} 작품을 한 번에 둘러보세요.`,
      items,
    });
    items.forEach((item) => usedSlugs.add(item.slug));
    if (shelves.length === limit) break;
  }

  return shelves;
}

function discoveryShelves(candidates: RecommendationSeries[]) {
  const usedSlugs = new Set<string>();
  const shelves: RecommendationShelf[] = [];

  for (const group of discoveryGroups) {
    const items = candidates
      .filter((series) => !usedSlugs.has(series.slug))
      .filter((series) =>
        group.genres.some(
          (genre) => genreAffinity(series.genre, genre) > 0,
        ),
      )
      .sort(byCoverThenTitle)
      .slice(0, 10);
    if (items.length < 2) continue;

    shelves.push({
      id: `discover-${group.id}`,
      eyebrow: group.eyebrow,
      title: group.title,
      description: group.description,
      items,
    });
    items.forEach((item) => usedSlugs.add(item.slug));
  }

  return shelves.length
    ? shelves
    : genreShelves(candidates, [], 3);
}

export function buildRecommendationShelves(
  series: RecommendationSeries[],
  favorites: FavoriteSeries[],
  progressStore: Record<string, ReadingProgress>,
): RecommendationShelf[] {
  const seriesBySlug = new Map(series.map((item) => [item.slug, item]));
  const latestProgressBySeries = new Map<string, ReadingProgress>();
  Object.values(progressStore)
    .sort(
      (left, right) =>
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    )
    .forEach((progress) => {
      if (!latestProgressBySeries.has(progress.seriesSlug)) {
        latestProgressBySeries.set(progress.seriesSlug, progress);
      }
    });

  const readingSeeds = [...latestProgressBySeries.keys()]
    .map((slug) => seriesBySlug.get(slug))
    .filter((item): item is RecommendationSeries => Boolean(item));
  const excludedSlugs = new Set([
    ...favorites.map((favorite) => favorite.slug),
    ...latestProgressBySeries.keys(),
  ]);
  const candidates = series.filter(
    (candidate) => !excludedSlugs.has(candidate.slug),
  );
  if (!candidates.length) return [];

  const preferredGenres = [
    ...favorites.map((favorite) => favorite.genre),
    ...readingSeeds.map((seed) => seed.genre),
  ];
  const personalized = personalizedShelf(
    candidates,
    favorites,
    readingSeeds,
  );
  if (!personalized && !preferredGenres.length) {
    return discoveryShelves(candidates);
  }

  const shelves = genreShelves(
    candidates,
    preferredGenres.filter(
      (genre) =>
        !personalized ||
        !personalized.items.some((item) => item.genre === genre),
    ),
    personalized ? 2 : 3,
    new Set(personalized?.items.map((item) => item.slug)),
  );

  return personalized ? [personalized, ...shelves] : shelves;
}
