import { z } from "zod";

export const ShortsPreviewQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const ShortsPreviewItemSchema = z.object({
  series: z.object({
    slug: z.string(),
    title: z.string(),
    synopsis: z.string(),
    genre: z.string(),
    coverUrl: z.string().nullable(),
    authorName: z.string(),
  }),
  episode: z.object({
    id: z.string(),
    number: z.number().int().positive(),
    title: z.string(),
  }),
  pages: z
    .array(
      z.object({
        id: z.string(),
        order: z.number().int().positive(),
        imageUrl: z.string(),
      }),
    )
    .min(1)
    .max(2),
});

export const ShortsPreviewResponseSchema = z.object({
  items: z.array(ShortsPreviewItemSchema).max(20),
});

export type ShortsPreviewItem = z.infer<typeof ShortsPreviewItemSchema>;
export type ShortsPreviewResponse = z.infer<
  typeof ShortsPreviewResponseSchema
>;
