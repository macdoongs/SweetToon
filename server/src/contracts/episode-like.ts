import { z } from "zod";

export const EpisodeLikeRequestSchema = z.object({
  viewerToken: z.string().uuid(),
  liked: z.boolean(),
});

export const EpisodeLikeResponseSchema = z.object({
  episodeId: z.string(),
  liked: z.boolean(),
  likeCount: z.number().int().nonnegative(),
});

export type EpisodeLikeResponse = z.infer<typeof EpisodeLikeResponseSchema>;
