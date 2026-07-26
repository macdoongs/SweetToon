export type StagedPage = {
  id: string;
  originalName: string;
  previewUrl: string;
  byteSize: number;
};

export type UploadPreview = {
  sessionId: string;
  originalName: string;
  expiresAt: string;
  pages: StagedPage[];
};

export type EpisodeVisibility = "public" | "private";

export type UploadPurpose = "publish" | "draft" | "packaging";

export type CreateEpisodeRequest = {
  sessionId: string;
  seasonId: string;
  number: number;
  title: string;
  pageIds: string[];
  visibility: EpisodeVisibility;
};

export type CreatedEpisode = {
  episodeId: string;
  seriesSlug: string;
  pageCount: number;
  readerUrl: string;
  visibility: EpisodeVisibility;
};

export type DraftEpisode = {
  id: string;
  number: number;
  title: string;
  publishedAt: string;
  season: { id: string; number: number };
  series: { slug: string; title: string };
};

export type PackagingBookSize = "A5" | "B5";
export type PackagingCoverType = "softcover" | "hardcover";
export type PackagingStatus =
  | "received"
  | "reviewing"
  | "completed"
  | "canceled";

export type CreatePackagingRequest = {
  sessionId: string;
  pageIds: string[];
  applicantName: string;
  bookTitle: string;
  bookSize: PackagingBookSize;
  coverType: PackagingCoverType;
  quantity: number;
  memo: string | null;
};

export type PackagingRequest = {
  id: string;
  applicantName: string;
  bookTitle: string;
  bookSize: PackagingBookSize;
  coverType: PackagingCoverType;
  quantity: number;
  memo: string | null;
  pageCount: number;
  status: PackagingStatus;
  createdAt: string;
};

export type UpdateSeriesInfoRequest = {
  title?: string;
  synopsis?: string;
};

export type SeriesInfoResponse = {
  seriesId: string;
  slug: string;
  title: string;
  synopsis: string;
};

export type CreateSeriesRequest = {
  slug: string;
  title: string;
  synopsis: string;
  genre: string;
  weekday: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  authorName: string;
};

export type CreateSeriesResponse = {
  seriesId: string;
  slug: string;
  title: string;
  seasonId: string;
};

export type StudioSeasonResponse = {
  seasonId: string;
  seriesId: string;
  number: number;
  status: "ongoing" | "completed";
};

export type AccessPolicy = {
  freeVolumeCount: number;
  previewEpisodeCount: number;
};

export type AccessPolicyResponse = AccessPolicy & {
  seriesId: string;
};
