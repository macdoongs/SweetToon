import { z } from "zod";
import { PublicationStatusSchema } from "./reader";

export const DiscoveryLimitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(50),
});

export const SitemapSeriesSchema = z.object({
  slug: z.string(),
  status: PublicationStatusSchema,
  coverUrl: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

export const DiscoveryEpisodeSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  title: z.string(),
  publishedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  series: z.object({
    slug: z.string(),
    title: z.string(),
    synopsis: z.string(),
    genre: z.string(),
    authorName: z.string(),
  }),
});

export const SitemapDiscoveryResponseSchema = z.object({
  series: z.array(SitemapSeriesSchema),
  episodes: z.array(DiscoveryEpisodeSchema),
});

export const RecentEpisodesResponseSchema = z.object({
  items: z.array(DiscoveryEpisodeSchema),
});

export type SitemapDiscoveryResponse = z.infer<
  typeof SitemapDiscoveryResponseSchema
>;
export type DiscoveryEpisode = z.infer<typeof DiscoveryEpisodeSchema>;
export type RecentEpisodesResponse = z.infer<
  typeof RecentEpisodesResponseSchema
>;
