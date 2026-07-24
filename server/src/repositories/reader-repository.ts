import { PrismaClient } from "@prisma/client";
import type {
  EpisodeReader,
  SeriesDetail,
  SeriesListResponse,
} from "../contracts/reader";

export interface ReaderRepository {
  listSeries(): Promise<SeriesListResponse>;
  findSeriesBySlug(slug: string): Promise<SeriesDetail | null>;
  findEpisodeById(id: string): Promise<EpisodeReader | null>;
}

export class PrismaReaderRepository implements ReaderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listSeries(): Promise<SeriesListResponse> {
    const series = await this.prisma.series.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        author: true,
        seasons: {
          include: {
            episodes: {
              orderBy: { number: "desc" },
            },
          },
        },
      },
    });

    return {
      items: series.map((item) => {
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
          coverUrl: item.coverUrl,
          status: item.status === "completed" ? "completed" : "ongoing",
          author: { name: item.author.name },
          episodeCount: episodes.length,
          completedSeasonCount: item.seasons.filter(
            (season) => season.status === "completed",
          ).length,
          latestEpisode: latestEpisode
            ? {
                id: latestEpisode.id,
                number: latestEpisode.number,
                title: latestEpisode.title,
                publishedAt: latestEpisode.publishedAt.toISOString(),
              }
            : null,
        };
      }),
    };
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
        })),
      })),
    };
  }

  async findEpisodeById(id: string): Promise<EpisodeReader | null> {
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
      pages: episode.pages.map((page) => ({
        id: page.id,
        order: page.order,
        imageUrl: page.imageUrl,
      })),
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
