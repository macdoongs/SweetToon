export const SERIES_FILTERS = ["all", "ongoing", "collectible"] as const;

export type SeriesFilter = (typeof SERIES_FILTERS)[number];

export function parseSeriesFilter(
  value: string | string[] | undefined,
): SeriesFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return SERIES_FILTERS.includes(candidate as SeriesFilter)
    ? (candidate as SeriesFilter)
    : "all";
}

export function seriesFilterQuery(filter: SeriesFilter): string {
  return filter === "all"
    ? "/api/series"
    : `/api/series?filter=${encodeURIComponent(filter)}`;
}
