import { PrismaClient, type Prisma } from "@prisma/client";
import type {
  EpisodeReader,
  SeriesDetail,
  SeriesListQuery,
  SeriesListResponse,
  SeriesSummary,
} from "../contracts/reader";
import { WeekdaySchema } from "../contracts/reader";
import type {
  DiscoveryEpisode,
  SitemapDiscoveryResponse,
} from "../contracts/discovery";

export interface ReaderRepository {
  listSeries(query: SeriesListQuery): Promise<SeriesListResponse>;
  listRealtimeSeriesKeys(): Promise<Array<{ slug: string; title: string }>>;
  listRealtimeSeries(slugs?: string[]): Promise<SeriesSummary[]>;
  seriesExists(slug: string): Promise<boolean>;
  findSeriesBySlug(slug: string): Promise<SeriesDetail | null>;
  findEpisodeById(
    id: string,
    accessToken?: string,
  ): Promise<EpisodeReader | null>;
  listSitemapDiscovery(): Promise<SitemapDiscoveryResponse>;
  listRecentEpisodes(limit: number): Promise<DiscoveryEpisode[]>;
}

const PUBLIC_EPISODES = { visibility: "public" } as const;

const seriesSummaryInclude = {
  author: true,
  seasons: {
    select: {
      status: true,
      _count: {
        select: { episodes: { where: PUBLIC_EPISODES } },
      },
      episodes: {
        where: PUBLIC_EPISODES,
        orderBy: { publishedAt: "desc" as const },
        take: 1,
      },
    },
  },
} satisfies Prisma.SeriesInclude;

const WEEKDAY_ORDER = new Map(
  WeekdaySchema.options.map((weekday, index) => [weekday, index]),
);
const FACET_CACHE_MS = 5 * 60_000;

type SeriesFacets = SeriesListResponse["facets"];

type SeriesSummaryRecord = Prisma.SeriesGetPayload<{
  include: typeof seriesSummaryInclude;
}>;

function toSeriesSummary(item: SeriesSummaryRecord): SeriesSummary {
  const episodes = item.seasons.flatMap((season) => season.episodes);
  const latestEpisode = [...episodes].sort(
    (left, right) =>
      right.publishedAt.getTime() - left.publishedAt.getTime(),
  )[0];

  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    synopsis: item.synopsis,
    genre: item.genre,
    weekday: WeekdaySchema.parse(item.weekday),
    freeVolumeCount: item.freeVolumeCount,
    previewEpisodeCount: item.previewEpisodeCount,
    coverUrl: item.coverUrl,
    status: item.status === "completed" ? "completed" : "ongoing",
    author: { name: item.author.name },
    episodeCount: item.seasons.reduce(
      (count, season) => count + season._count.episodes,
      0,
    ),
    completedSeasonCount: item.seasons.filter(
      (season) => season.status === "completed",
    ).length,
    latestEpisode: latestEpisode
      ? {
          id: latestEpisode.id,
          number: latestEpisode.number,
          title: latestEpisode.title,
          publishedAt: latestEpisode.publishedAt.toISOString(),
          volumeNumber: Math.ceil(latestEpisode.number / 5),
          access:
            latestEpisode.number <=
            item.freeVolumeCount * 5 + item.previewEpisodeCount
              ? "free"
              : "locked",
        }
      : null,
  };
}

function toDiscoveryEpisode(
  episode: {
    id: string;
    number: number;
    title: string;
    publishedAt: Date;
    updatedAt: Date;
  },
  series: {
    slug: string;
    title: string;
    synopsis: string;
    genre: string;
    author: { name: string };
  },
): DiscoveryEpisode {
  return {
    id: episode.id,
    number: episode.number,
    title: episode.title,
    publishedAt: episode.publishedAt.toISOString(),
    updatedAt: episode.updatedAt.toISOString(),
    series: {
      slug: series.slug,
      title: series.title,
      synopsis: series.synopsis,
      genre: series.genre,
      authorName: series.author.name,
    },
  };
}

export class PrismaReaderRepository implements ReaderRepository {
  private facetCache:
    | { expiresAt: number; value: SeriesFacets }
    | undefined;
  private facetLoad: Promise<SeriesFacets> | undefined;

  constructor(private readonly prisma: PrismaClient) {}

  async listSeries(query: SeriesListQuery): Promise<SeriesListResponse> {
    const where: Prisma.SeriesWhereInput = {
      ...(query.filter === "ongoing"
        ? { status: "ongoing" }
        : query.filter === "collectible"
          ? { seasons: { some: { status: "completed" } } }
          : {}),
      ...(query.genre ? { genre: query.genre } : {}),
      ...(query.weekday ? { weekday: query.weekday } : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [[coveredCount, total], facets] = await Promise.all([
      this.prisma.$transaction([
        this.prisma.series.count({
          where: { ...where, coverUrl: { not: null } },
        }),
        this.prisma.series.count({ where }),
      ]),
      this.loadFacets(),
    ]);
    const coveredTake = Math.min(
      query.pageSize,
      Math.max(0, coveredCount - skip),
    );
    const covered =
      coveredTake > 0
        ? await this.prisma.series.findMany({
            where: { ...where, coverUrl: { not: null } },
            skip,
            take: coveredTake,
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            include: seriesSummaryInclude,
          })
        : [];
    const uncoveredTake = query.pageSize - covered.length;
    const uncovered =
      uncoveredTake > 0 && coveredCount < total
        ? await this.prisma.series.findMany({
            where: { ...where, coverUrl: null },
            skip: Math.max(0, skip - coveredCount),
            take: uncoveredTake,
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            include: seriesSummaryInclude,
          })
        : [];
    const series = [...covered, ...uncovered];

    return {
      items: series.map(toSeriesSummary),
      page: query.page,
      nextPage: skip + series.length < total ? query.page + 1 : null,
      total,
      facets,
    };
  }

  private async loadFacets(): Promise<SeriesFacets> {
    const now = Date.now();
    if (this.facetCache && this.facetCache.expiresAt > now) {
      return this.facetCache.value;
    }
    if (!this.facetLoad) {
      this.facetLoad = this.prisma
        .$transaction([
          this.prisma.series.findMany({
            select: { genre: true },
            distinct: ["genre"],
            orderBy: { genre: "asc" },
          }),
          this.prisma.series.findMany({
            select: { weekday: true },
            distinct: ["weekday"],
          }),
        ])
        .then(([genres, weekdays]) => {
          const value: SeriesFacets = {
            genres: genres.map((item) => item.genre),
            weekdays: weekdays
              .map((item) => WeekdaySchema.parse(item.weekday))
              .sort(
                (left, right) =>
                  (WEEKDAY_ORDER.get(left) ?? 0) -
                  (WEEKDAY_ORDER.get(right) ?? 0),
              ),
          };
          this.facetCache = {
            expiresAt: Date.now() + FACET_CACHE_MS,
            value,
          };
          return value;
        })
        .finally(() => {
          this.facetLoad = undefined;
        });
    }
    return this.facetLoad;
  }

  async listRealtimeSeriesKeys(): Promise<
    Array<{ slug: string; title: string }>
  > {
    const series = await this.prisma.series.findMany({
      where: { coverUrl: { not: null } },
      select: { slug: true, title: true },
    });
    return series;
  }

  async listRealtimeSeries(slugs?: string[]): Promise<SeriesSummary[]> {
    if (slugs?.length === 0) return [];
    const series = await this.prisma.series.findMany({
      where: {
        coverUrl: { not: null },
        ...(slugs ? { slug: { in: slugs } } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: seriesSummaryInclude,
    });
    return series.map(toSeriesSummary);
  }

  async seriesExists(slug: string): Promise<boolean> {
    return Boolean(
      await this.prisma.series.findUnique({
        where: { slug },
        select: { id: true },
      }),
    );
  }

  async listSitemapDiscovery(): Promise<SitemapDiscoveryResponse> {
    const series = await this.prisma.series.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        author: { select: { name: true } },
        seasons: {
          select: {
            episodes: {
              where: PUBLIC_EPISODES,
              orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                number: true,
                title: true,
                publishedAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    return {
      series: series.map((item) => {
        const latestEpisodeUpdate = item.seasons
          .flatMap((season) => season.episodes)
          .reduce(
            (latest, episode) =>
              episode.updatedAt > latest ? episode.updatedAt : latest,
            item.updatedAt,
          );
        return {
          slug: item.slug,
          status: item.status === "completed" ? "completed" : "ongoing",
          coverUrl: item.coverUrl,
          updatedAt: latestEpisodeUpdate.toISOString(),
        };
      }),
      episodes: series.flatMap((item) =>
        item.seasons.flatMap((season) =>
          season.episodes.map((episode) =>
            toDiscoveryEpisode(episode, item),
          ),
        ),
      ),
    };
  }

  async listRecentEpisodes(limit: number): Promise<DiscoveryEpisode[]> {
    const episodes = await this.prisma.episode.findMany({
      where: PUBLIC_EPISODES,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: limit,
      include: {
        season: {
          include: {
            series: { include: { author: { select: { name: true } } } },
          },
        },
      },
    });
    return episodes.map((episode) =>
      toDiscoveryEpisode(episode, episode.season.series),
    );
  }

  async findSeriesBySlug(slug: string): Promise<SeriesDetail | null> {
    const series = await this.prisma.series.findUnique({
      where: { slug },
      include: {
        author: true,
        seasons: {
          orderBy: { number: "asc" },
          include: {
            episodes: {
              where: PUBLIC_EPISODES,
              orderBy: { number: "asc" },
            },
          },
        },
      },
    });

    if (!series) {
      return null;
    }

    return {
      id: series.id,
      slug: series.slug,
      title: series.title,
      synopsis: series.synopsis,
      genre: series.genre,
      weekday: WeekdaySchema.parse(series.weekday),
      freeVolumeCount: series.freeVolumeCount,
      previewEpisodeCount: series.previewEpisodeCount,
      coverUrl: series.coverUrl,
      status: series.status === "completed" ? "completed" : "ongoing",
      author: {
        name: series.author.name,
        bio: series.author.bio,
        avatarUrl: series.author.avatarUrl,
      },
      seasons: series.seasons.map((season) => ({
        id: season.id,
        number: season.number,
        title: season.title,
        status: season.status === "completed" ? "completed" : "ongoing",
        episodes: season.episodes.map((episode) => ({
          id: episode.id,
          number: episode.number,
          title: episode.title,
          publishedAt: episode.publishedAt.toISOString(),
          volumeNumber: Math.ceil(episode.number / 5),
          access:
            episode.number <=
            series.freeVolumeCount * 5 + series.previewEpisodeCount
              ? "free"
              : "locked",
        })),
      })),
    };
  }

  async findEpisodeById(
    id: string,
    accessToken?: string,
  ): Promise<EpisodeReader | null> {
    const episode = await this.prisma.episode.findUnique({
      where: { id },
      include: {
        season: {
          include: {
            series: true,
            episodes: {
              where: PUBLIC_EPISODES,
              orderBy: { number: "asc" },
              select: { id: true, number: true },
            },
          },
        },
      },
    });

    if (!episode) {
      return null;
    }

    // 이전·다음 이동은 시즌 경계를 넘어 작품 전체의
    // (시즌 번호, 회차 번호) 순서로 계산한다.
    const seriesEpisodes = await this.prisma.episode.findMany({
      where: {
        ...PUBLIC_EPISODES,
        season: { seriesId: episode.season.seriesId },
      },
      orderBy: [{ season: { number: "asc" } }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        season: { select: { number: true } },
      },
    });
    const episodeIndex = seriesEpisodes.findIndex(
      (candidate) => candidate.id === episode.id,
    );
    const nextEpisode =
      episodeIndex >= 0 && episodeIndex < seriesEpisodes.length - 1
        ? seriesEpisodes[episodeIndex + 1]
        : null;
    const volumeNumber = Math.ceil(episode.number / 5);
    const isFree =
      episode.number <=
      episode.season.series.freeVolumeCount * 5 +
        episode.season.series.previewEpisodeCount;
    const hasEntitlement =
      !isFree &&
      Boolean(accessToken) &&
      accessToken!.length <= 100 &&
      ((await this.prisma.order.count({
          where: {
            entitlementToken: accessToken,
            seasonId: episode.season.id,
            volumeNumber,
            status: { not: "canceled" },
          },
        })) > 0 ||
        (await this.prisma.candyEpisodeEntitlement.count({
          where: {
            walletToken: accessToken,
            episodeId: episode.id,
          },
        })) > 0);
    const accessState = isFree
      ? "free"
      : hasEntitlement
        ? "entitled"
        : "locked";
    const pages =
      accessState === "locked"
        ? []
        : await this.prisma.page.findMany({
            where: { episodeId: episode.id },
            orderBy: { order: "asc" },
          });

    return {
      id: episode.id,
      number: episode.number,
      title: episode.title,
      visibility: episode.visibility === "private" ? "private" : "public",
      publishedAt: episode.publishedAt.toISOString(),
      series: {
        id: episode.season.series.id,
        slug: episode.season.series.slug,
        title: episode.season.series.title,
      },
      season: {
        id: episode.season.id,
        number: episode.season.number,
        title: episode.season.title,
        status:
          episode.season.status === "completed" ? "completed" : "ongoing",
      },
      pages: pages.map((page) => ({
        id: page.id,
        order: page.order,
        imageUrl: page.imageUrl,
      })),
      access: {
        state: accessState,
        volumeNumber,
        freeVolumeCount: episode.season.series.freeVolumeCount,
        previewEpisodeCount: episode.season.series.previewEpisodeCount,
      },
      navigation: {
        previousEpisodeId:
          episodeIndex > 0 ? seriesEpisodes[episodeIndex - 1].id : null,
        nextEpisodeId: nextEpisode?.id ?? null,
        // 다음 화가 다른 시즌이면 리더가 시즌 시작 CTA를 보여줄 수 있다.
        nextEpisodeSeasonNumber: nextEpisode?.season.number ?? null,
      },
    };
  }
}
