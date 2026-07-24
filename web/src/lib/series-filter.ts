export const SERIES_FILTERS = ["all", "ongoing", "collectible"] as const;

export type SeriesFilter = (typeof SERIES_FILTERS)[number];
export const WEEKDAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type CatalogFilters = {
  filter: SeriesFilter;
  genre?: string;
  weekday?: Weekday;
};

export function parseSeriesFilter(
  value: string | string[] | undefined,
): SeriesFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return SERIES_FILTERS.includes(candidate as SeriesFilter)
    ? (candidate as SeriesFilter)
    : "all";
}

export function parseWeekday(
  value: string | string[] | undefined,
): Weekday | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return WEEKDAYS.includes(candidate as Weekday)
    ? (candidate as Weekday)
    : undefined;
}

export function parseGenre(
  value: string | string[] | undefined,
): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && candidate.length <= 40 ? candidate : undefined;
}

export function seriesFilterQuery(
  filters: CatalogFilters,
  page = 1,
  pageSize = 12,
): string {
  const params = new URLSearchParams();
  if (filters.filter !== "all") params.set("filter", filters.filter);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.weekday) params.set("weekday", filters.weekday);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return `/api/series?${params.toString()}`;
}

export function catalogHref(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  if (filters.filter !== "all") params.set("filter", filters.filter);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.weekday) params.set("weekday", filters.weekday);
  const query = params.toString();
  return `${query ? `/?${query}` : "/"}#discover`;
}
