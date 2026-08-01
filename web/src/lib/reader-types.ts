export type PublicationStatus = "ongoing" | "completed";

export type EpisodeSummary = {
  id: string;
  number: number;
  title: string;
  publishedAt: string;
  volumeNumber: number;
  access: "free" | "locked";
};

export type SeriesSummary = {
  id: string;
  slug: string;
  title: string;
  synopsis: string;
  genre: string;
  weekday: Weekday;
  freeVolumeCount: number;
  previewEpisodeCount: number;
  coverUrl: string | null;
  status: PublicationStatus;
  author: { name: string };
  episodeCount: number;
  completedSeasonCount: number;
  latestEpisode: EpisodeSummary | null;
};

export type Weekday =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export type SeriesListResponse = {
  items: SeriesSummary[];
  page: number;
  nextPage: number | null;
  total: number;
  facets: {
    genres: string[];
    weekdays: Weekday[];
  };
};

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
  visibility?: "public" | "private";
  publishedAt: string;
  likeCount: number;
  series: { id: string; slug: string; title: string };
  season: {
    id: string;
    number: number;
    title: string | null;
    status: PublicationStatus;
  };
  pages: Array<{
    id: string;
    order: number;
    imageUrl: string;
  }>;
  access: {
    state: "free" | "entitled" | "locked";
    volumeNumber: number;
    freeVolumeCount: number;
    previewEpisodeCount: number;
  };
  navigation: {
    previousEpisodeId: string | null;
    nextEpisodeId: string | null;
    nextEpisodeSeasonNumber: number | null;
  };
};
