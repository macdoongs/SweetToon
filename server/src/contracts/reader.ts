import { z } from "zod";

export const PublicationStatusSchema = z.enum(["ongoing", "completed"]);
export const SeriesFilterSchema = z.enum(["all", "ongoing", "collectible"]);
export const WeekdaySchema = z.enum([
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
]);

export const SeriesListQuerySchema = z.object({
  filter: SeriesFilterSchema.default("all"),
  genre: z.string().trim().min(1).max(40).optional(),
  weekday: WeekdaySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
});

export const EpisodeSummarySchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  title: z.string(),
  publishedAt: z.string().datetime(),
  volumeNumber: z.number().int().positive(),
  access: z.enum(["free", "locked"]),
});

export const SeriesSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  synopsis: z.string(),
  genre: z.string(),
  weekday: WeekdaySchema,
  freeVolumeCount: z.number().int().nonnegative(),
  previewEpisodeCount: z.number().int().min(0).max(4),
  coverUrl: z.string().nullable(),
  status: PublicationStatusSchema,
  author: z.object({
    name: z.string(),
  }),
  episodeCount: z.number().int().nonnegative(),
  completedSeasonCount: z.number().int().nonnegative(),
  latestEpisode: EpisodeSummarySchema.nullable(),
});

export const SeriesListResponseSchema = z.object({
  items: z.array(SeriesSummarySchema),
  page: z.number().int().positive(),
  nextPage: z.number().int().positive().nullable(),
  total: z.number().int().nonnegative(),
  facets: z.object({
    genres: z.array(z.string()),
    weekdays: z.array(WeekdaySchema),
  }),
});

export const SeasonDetailSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  title: z.string().nullable(),
  status: PublicationStatusSchema,
  episodes: z.array(EpisodeSummarySchema),
});

export const SeriesDetailSchema = SeriesSummarySchema.omit({
  episodeCount: true,
  completedSeasonCount: true,
  latestEpisode: true,
}).extend({
  author: z.object({
    name: z.string(),
    bio: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
  seasons: z.array(SeasonDetailSchema),
});

export const PageImageSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  imageUrl: z.string(),
});

export const EpisodeReaderSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  title: z.string(),
  publishedAt: z.string().datetime(),
  series: z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
  }),
  season: z.object({
    id: z.string(),
    number: z.number().int().positive(),
    title: z.string().nullable(),
  }),
  pages: z.array(PageImageSchema),
  access: z.object({
    state: z.enum(["free", "entitled", "locked"]),
    volumeNumber: z.number().int().positive(),
    freeVolumeCount: z.number().int().nonnegative(),
    previewEpisodeCount: z.number().int().min(0).max(4),
  }),
  navigation: z.object({
    previousEpisodeId: z.string().nullable(),
    nextEpisodeId: z.string().nullable(),
  }),
});

export const SlugParamSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const IdParamSchema = z.string().min(1).max(80);

export type SeriesListResponse = z.infer<typeof SeriesListResponseSchema>;
export type SeriesSummary = z.infer<typeof SeriesSummarySchema>;
export type SeriesDetail = z.infer<typeof SeriesDetailSchema>;
export type EpisodeReader = z.infer<typeof EpisodeReaderSchema>;
export type SeriesFilter = z.infer<typeof SeriesFilterSchema>;
export type SeriesListQuery = z.infer<typeof SeriesListQuerySchema>;
