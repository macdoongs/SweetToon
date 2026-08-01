import "server-only";
import type {
  EpisodeReader,
  SeriesDetail,
  SeriesListResponse,
} from "./reader-types";
import {
  seriesFilterQuery,
  type CatalogFilters,
} from "./series-filter";
import type { OrderDetail, OrderListResponse } from "./order-types";
import type { StudioSeriesListResponse } from "./studio-types";
import type {
  RecentEpisodesResponse,
  SitemapDiscoveryResponse,
} from "./discovery-types";
import type { ShortsPreviewResponse } from "./shorts-types";

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

async function serverGetJson<T>(
  path: string,
  options: { fresh?: boolean } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_INTERNAL_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      ...(options.fresh
        ? { cache: "no-store" as const }
        : { next: { revalidate: 300 } }),
    });
  } catch {
    throw new ServerApiError(
      "서버 연결이 지연되고 있습니다. 잠시 뒤 다시 시도해 주세요.",
      503,
    );
  }

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

export function getStudioSeriesList(): Promise<StudioSeriesListResponse> {
  return serverGetJson("/api/studio/series", { fresh: true });
}

export function getSeriesList(
  filters: CatalogFilters = { filter: "all" },
  page = 1,
): Promise<SeriesListResponse> {
  return serverGetJson(seriesFilterQuery(filters, page), { fresh: true });
}

export async function getAllSeries(): Promise<SeriesListResponse> {
  const pageSize = 100;
  // 추천 선반 용도이므로 전량이 아니어도 된다. 서버가 잘못된 nextPage를
  // 돌려줘도 홈 렌더가 무한 루프에 빠지지 않도록 페이지 수를 제한한다.
  const maxPages = 20;
  let page = 1;
  let result = await serverGetJson<SeriesListResponse>(
    seriesFilterQuery({ filter: "all" }, page, pageSize),
  );
  const items = [...result.items];
  let fetchedPages = 1;
  while (result.nextPage && result.nextPage > page && fetchedPages < maxPages) {
    page = result.nextPage;
    result = await serverGetJson<SeriesListResponse>(
      seriesFilterQuery({ filter: "all" }, page, pageSize),
    );
    items.push(...result.items);
    fetchedPages += 1;
  }
  return { ...result, items, page: 1, nextPage: null };
}

export function getSeriesDetail(
  slug: string,
  options: { fresh?: boolean } = { fresh: true },
): Promise<SeriesDetail> {
  return serverGetJson(`/api/series/${encodeURIComponent(slug)}`, {
    fresh: options.fresh,
  });
}

export function getEpisode(episodeId: string): Promise<EpisodeReader> {
  return serverGetJson(`/api/episodes/${encodeURIComponent(episodeId)}`, {
    fresh: true,
  });
}

export function getOrders(
  cursor?: string,
  limit = 20,
): Promise<OrderListResponse> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  return serverGetJson(`/api/orders?${query.toString()}`, { fresh: true });
}

export function getOrder(orderId: string): Promise<OrderDetail> {
  return serverGetJson(`/api/orders/${encodeURIComponent(orderId)}`, {
    fresh: true,
  });
}

export function getSitemapDiscovery(): Promise<SitemapDiscoveryResponse> {
  return serverGetJson("/api/discovery/sitemap");
}

export function getRecentEpisodes(
  limit = 50,
): Promise<RecentEpisodesResponse> {
  const query = new URLSearchParams({ limit: String(limit) });
  return serverGetJson(
    `/api/discovery/recent-episodes?${query.toString()}`,
  );
}

export function getShortsPreviews(limit = 10): Promise<ShortsPreviewResponse> {
  const query = new URLSearchParams({ limit: String(limit) });
  return serverGetJson(`/api/discovery/shorts?${query.toString()}`, {
    fresh: true,
  });
}
