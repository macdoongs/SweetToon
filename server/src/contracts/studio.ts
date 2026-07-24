import { z } from "zod";

export const UploadSessionIdSchema = z.string().uuid();
export const UploadPageIdSchema = z.string().uuid();

export const StagedPageSchema = z.object({
  id: UploadPageIdSchema,
  originalName: z.string().min(1),
  previewUrl: z.string().min(1),
  byteSize: z.number().int().positive(),
});

export const UploadPreviewSchema = z.object({
  sessionId: UploadSessionIdSchema,
  originalName: z.string().min(1),
  expiresAt: z.string().datetime(),
  pages: z.array(StagedPageSchema).min(1),
});

export const CreateEpisodeRequestSchema = z.object({
  sessionId: UploadSessionIdSchema,
  seasonId: z.string().min(1).max(80),
  number: z.number().int().positive().max(10_000),
  title: z.string().trim().min(1).max(80),
  pageIds: z.array(UploadPageIdSchema).min(1).max(80),
});

export const CreatedEpisodeSchema = z.object({
  episodeId: z.string(),
  seriesSlug: z.string(),
  pageCount: z.number().int().positive(),
  readerUrl: z.string(),
});

export type UploadPreview = z.infer<typeof UploadPreviewSchema>;
export type CreateEpisodeRequest = z.infer<
  typeof CreateEpisodeRequestSchema
>;
export type CreatedEpisode = z.infer<typeof CreatedEpisodeSchema>;
