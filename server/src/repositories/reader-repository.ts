import { PrismaClient, type Prisma } from "@prisma/client";
import type {
  EpisodeReader,
  SeriesDetail,
  SeriesListQuery,
  SeriesListResponse,
  SeriesSummary,
} from "../contracts/reader";
import { WeekdaySchema } from "../contracts/reader";

export interface ReaderRepository {
  listSeries(query: SeriesListQuery): Promise<SeriesListResponse>;
  listRealtimeSeries(): Promise<SeriesSummary[]>;
  seriesExists(slug: string): Promise<boolean>;
  findSeriesBySlug(slug: string): Promise<SeriesDetail | null>;
  findEpisodeById(
    id: string,
    accessToken?: string,
  ): Promise<EpisodeReader | null>;
}

const seriesSummaryInclude = {
  author: true,
  seasons: {
    select: {
      status: true,
      _count: { select: { episodes: true } },
      episodes: {
        orderBy: { publishedAt: "desc" as const },
        take: 1,
      },
    },
  },
} satisfies Prisma.SeriesInclude;

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

export class PrismaReaderRepository implements ReaderRepository {
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
    const [series, total, genres, weekdays] = await this.prisma.$transaction([
      this.prisma.series.findMany({
      where,
      skip,
      take: query.pageSize,
      orderBy: [
        { coverUrl: { sort: "asc", nulls: "last" } },
        { status: "asc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      include: seriesSummaryInclude,
      }),
      this.prisma.series.count({ where }),
      this.prisma.series.findMany({
        select: { genre: true },
        distinct: ["genre"],
        orderBy: { genre: "asc" },
      }),
      this.prisma.series.findMany({
        select: { weekday: true },
        distinct: ["weekday"],
      }),
    ]);

    return {
      items: series.map(toSeriesSummary),
      page: query.page,
      nextPage: skip + series.length < total ? query.page + 1 : null,
      total,
      facets: {
        genres: genres.map((item) => item.genre),
        weekdays: weekdays.map((item) => WeekdaySchema.parse(item.weekday)),
      },
    };
  }

  async listRealtimeSeries(): Promise<SeriesSummary[]> {
    const series = await this.prisma.series.findMany({
      where: { coverUrl: { not: null } },
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

  async findSeriesBySlug(slug: string): Promise<SeriesDetail | null> {
    const series = await this.prisma.series.findUnique({
      where: { slug },
      include: {
        author: true,
        seasons: {
          orderBy: { number: "asc" },
          include: {
            episodes: {
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
        pages: {
          orderBy: { order: "asc" },
        },
        season: {
          include: {
            series: true,
            episodes: {
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

    const episodeIndex = episode.season.episodes.findIndex(
      (candidate) => candidate.id === episode.id,
    );
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

    return {
      id: episode.id,
      number: episode.number,
      title: episode.title,
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
      },
      pages:
        accessState === "locked"
          ? []
          : episode.pages.map((page) => ({
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
          episodeIndex > 0
            ? episode.season.episodes[episodeIndex - 1].id
            : null,
        nextEpisodeId:
          episodeIndex >= 0 &&
          episodeIndex < episode.season.episodes.length - 1
            ? episode.season.episodes[episodeIndex + 1].id
            : null,
      },
    };
  }
}
