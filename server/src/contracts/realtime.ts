import { z } from "zod";
import { SeriesSummarySchema } from "./reader";

export const PresenceHeartbeatSchema = z.object({
  sessionId: z.string().uuid(),
});

export const PresenceResponseSchema = z.object({
  seriesSlug: z.string(),
  viewerCount: z.number().int().nonnegative(),
  expiresInSeconds: z.number().int().positive(),
});

export const LiveSeriesSchema = z.object({
  series: SeriesSummarySchema,
  viewerCount: z.number().int().positive(),
});

export const LivePopularResponseSchema = z.object({
  items: z.array(LiveSeriesSchema),
  generatedAt: z.string().datetime(),
});
