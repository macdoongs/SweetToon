import { z } from "zod";

export const ShortsPreviewQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
  exclude: z
    .string()
    .max(4_100)
    .optional()
    .transform((value) =>
      value
        ? [...new Set(value.split(",").filter((slug) => slug.length > 0))]
        : [],
    )
    .pipe(
      z
        .array(
          z
            .string()
            .min(1)
            .max(80)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        )
        .max(50),
    ),
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
    likeCount: z.number().int().nonnegative(),
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
