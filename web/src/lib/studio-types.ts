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

export type CreateEpisodeRequest = {
  sessionId: string;
  seasonId: string;
  number: number;
  title: string;
  pageIds: string[];
};

export type CreatedEpisode = {
  episodeId: string;
  seriesSlug: string;
  pageCount: number;
  readerUrl: string;
};
