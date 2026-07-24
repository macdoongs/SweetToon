import "server-only";
import type {
  EpisodeReader,
  SeriesDetail,
  SeriesListResponse,
} from "./reader-types";
import type { OrderDetail, OrderListResponse } from "./order-types";

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
  const response = await fetch(`${API_INTERNAL_URL}${path}`, {
    headers: { Accept: "application/json" },
    ...(options.fresh
      ? { cache: "no-store" as const }
      : { next: { revalidate: 300 } }),
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
  return serverGetJson("/api/series", { fresh: true });
}

export function getSeriesDetail(slug: string): Promise<SeriesDetail> {
  return serverGetJson(`/api/series/${encodeURIComponent(slug)}`, {
    fresh: true,
  });
}

export function getEpisode(episodeId: string): Promise<EpisodeReader> {
  return serverGetJson(`/api/episodes/${encodeURIComponent(episodeId)}`, {
    fresh: true,
  });
}

export function getOrders(): Promise<OrderListResponse> {
  return serverGetJson("/api/orders", { fresh: true });
}

export function getOrder(orderId: string): Promise<OrderDetail> {
  return serverGetJson(`/api/orders/${encodeURIComponent(orderId)}`, {
    fresh: true,
  });
}
