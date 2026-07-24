export type PublicationStatus = "ongoing" | "completed";

export type EpisodeSummary = {
  id: string;
  number: number;
  title: string;
  publishedAt: string;
};

export type SeriesSummary = {
  id: string;
  slug: string;
  title: string;
  synopsis: string;
  genre: string;
  coverUrl: string | null;
  status: PublicationStatus;
  author: { name: string };
  episodeCount: number;
  completedSeasonCount: number;
  latestEpisode: EpisodeSummary | null;
};

export type SeriesListResponse = { items: SeriesSummary[] };

export type SeriesDetail = Omit<
  SeriesSummary,
  "episodeCount" | "completedSeasonCount" | "latestEpisode" | "author"
> & {
  author: {
    name: string;
    bio: string | null;
    avatarUrl: string | null;
  };
  seasons: Array<{
    id: string;
    number: number;
    title: string | null;
    status: PublicationStatus;
    episodes: EpisodeSummary[];
  }>;
};

export type EpisodeReader = {
  id: string;
  number: number;
  title: string;
  publishedAt: string;
  series: { id: string; slug: string; title: string };
  season: { id: string; number: number; title: string | null };
  pages: Array<{
    id: string;
    order: number;
    imageUrl: string;
  }>;
  navigation: {
    previousEpisodeId: string | null;
    nextEpisodeId: string | null;
  };
};
