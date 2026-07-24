import "server-only";
import type {
  EpisodeReader,
  SeriesDetail,
  SeriesListResponse,
} from "./reader-types";

const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ?? "http://localhost:4000";

export class ServerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ServerApiError";
  }
}

async function serverGetJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_INTERNAL_URL}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new ServerApiError(
      error?.message ?? "데이터를 불러오지 못했습니다.",
      response.status,
    );
  }

  return (await response.json()) as T;
}

export function getSeriesList(): Promise<SeriesListResponse> {
  return serverGetJson("/api/series");
}

export function getSeriesDetail(slug: string): Promise<SeriesDetail> {
  return serverGetJson(`/api/series/${encodeURIComponent(slug)}`);
}

export function getEpisode(episodeId: string): Promise<EpisodeReader> {
  return serverGetJson(`/api/episodes/${encodeURIComponent(episodeId)}`);
}
