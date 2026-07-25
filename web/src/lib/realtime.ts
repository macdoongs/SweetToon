import type { SeriesSummary } from "./reader-types";

const READER_SESSION_KEY = "sweettoon:reader-session";

export type PresenceResponse = {
  seriesSlug: string;
  viewerCount: number;
  expiresInSeconds: number;
};

export type LivePopularResponse = {
  items: Array<{
    series: SeriesSummary;
    viewerCount: number;
  }>;
  generatedAt: string;
};

export function getReaderSessionId(): string {
  const existing = localStorage.getItem(READER_SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(READER_SESSION_KEY, created);
  return created;
}
