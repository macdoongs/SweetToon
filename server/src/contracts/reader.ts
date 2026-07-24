import { z } from "zod";

export const PublicationStatusSchema = z.enum(["ongoing", "completed"]);

export const EpisodeSummarySchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  title: z.string(),
  publishedAt: z.string().datetime(),
});

export const SeriesSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  synopsis: z.string(),
  genre: z.string(),
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
export type SeriesDetail = z.infer<typeof SeriesDetailSchema>;
export type EpisodeReader = z.infer<typeof EpisodeReaderSchema>;
