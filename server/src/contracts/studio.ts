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

export const EpisodeVisibilitySchema = z.enum(["public", "private"]);

export const CreateEpisodeRequestSchema = z.object({
  sessionId: UploadSessionIdSchema,
  seasonId: z.string().min(1).max(80),
  number: z.number().int().positive().max(10_000),
  title: z.string().trim().min(1).max(80),
  pageIds: z.array(UploadPageIdSchema).min(1).max(80),
  visibility: EpisodeVisibilitySchema.default("public"),
});

export const CreatedEpisodeSchema = z.object({
  episodeId: z.string(),
  seriesSlug: z.string(),
  pageCount: z.number().int().positive(),
  readerUrl: z.string(),
  visibility: EpisodeVisibilitySchema,
});

export const UpdateEpisodeVisibilityRequestSchema = z.object({
  visibility: EpisodeVisibilitySchema,
});

export const DraftEpisodeSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  title: z.string(),
  publishedAt: z.string().datetime(),
  season: z.object({
    id: z.string(),
    number: z.number().int().positive(),
  }),
  series: z.object({
    slug: z.string(),
    title: z.string(),
  }),
});

export const DraftEpisodeListSchema = z.object({
  items: z.array(DraftEpisodeSchema),
});

export const PackagingBookSizeSchema = z.enum(["A5", "B5"]);
export const PackagingCoverTypeSchema = z.enum(["softcover", "hardcover"]);
export const PackagingStatusSchema = z.enum([
  "received",
  "reviewing",
  "completed",
  "canceled",
]);

export const CreatePackagingRequestSchema = z.object({
  sessionId: UploadSessionIdSchema,
  pageIds: z.array(UploadPageIdSchema).min(1).max(80),
  applicantName: z.string().trim().min(2).max(40),
  bookTitle: z.string().trim().min(1).max(80),
  bookSize: PackagingBookSizeSchema,
  coverType: PackagingCoverTypeSchema,
  quantity: z.number().int().min(1).max(500),
  memo: z.string().trim().max(500).nullable().optional(),
});

export const PackagingRequestSchema = z.object({
  id: z.string(),
  applicantName: z.string(),
  bookTitle: z.string(),
  bookSize: PackagingBookSizeSchema,
  coverType: PackagingCoverTypeSchema,
  quantity: z.number().int().positive(),
  memo: z.string().nullable(),
  pageCount: z.number().int().positive(),
  status: PackagingStatusSchema,
  createdAt: z.string().datetime(),
});

export const PackagingRequestListSchema = z.object({
  items: z.array(PackagingRequestSchema),
});

export const AccessPolicySchema = z.object({
  freeVolumeCount: z.number().int().min(0).max(20),
  previewEpisodeCount: z.number().int().min(0).max(4),
});

export const AccessPolicyResponseSchema = AccessPolicySchema.extend({
  seriesId: z.string(),
});

export type EpisodeVisibility = z.infer<typeof EpisodeVisibilitySchema>;
export type DraftEpisode = z.infer<typeof DraftEpisodeSchema>;
export type CreatePackagingRequest = z.infer<
  typeof CreatePackagingRequestSchema
>;
export type PackagingRequest = z.infer<typeof PackagingRequestSchema>;
export type UploadPreview = z.infer<typeof UploadPreviewSchema>;
export type CreateEpisodeRequest = z.infer<
  typeof CreateEpisodeRequestSchema
>;
export type CreatedEpisode = z.infer<typeof CreatedEpisodeSchema>;
export type AccessPolicy = z.infer<typeof AccessPolicySchema>;
export type AccessPolicyResponse = z.infer<
  typeof AccessPolicyResponseSchema
>;
