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
  requestKey: z.string().uuid(),
  sessionId: UploadSessionIdSchema,
  seasonId: z.string().min(1).max(80),
  number: z
    .number("회차 번호는 숫자로 입력해 주세요.")
    .int("회차 번호는 정수로 입력해 주세요.")
    .positive("회차 번호는 1 이상 입력해 주세요.")
    .max(10_000, "회차 번호는 10000 이하로 입력해 주세요."),
  title: z
    .string("회차 제목을 입력해 주세요.")
    .trim()
    .min(1, "회차 제목을 입력해 주세요.")
    .max(80, "회차 제목은 80자 이하로 입력해 주세요."),
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

export const UpdateEpisodeRequestSchema = z
  .object({
    title: z
      .string("회차 제목을 입력해 주세요.")
      .trim()
      .min(1, "회차 제목을 입력해 주세요.")
      .max(80, "회차 제목은 80자 이하로 입력해 주세요.")
      .optional(),
    number: z
      .number("회차 번호는 숫자로 입력해 주세요.")
      .int("회차 번호는 정수로 입력해 주세요.")
      .positive("회차 번호는 1 이상 입력해 주세요.")
      .max(10_000, "회차 번호는 10000 이하로 입력해 주세요.")
      .optional(),
  })
  .refine(
    (value) => value.title !== undefined || value.number !== undefined,
    { message: "수정할 항목을 한 가지 이상 보내 주세요." },
  );

export const SeriesCoverResponseSchema = z.object({
  seriesId: z.string(),
  coverUrl: z.string().min(1),
});

export const ReplaceEpisodePagesRequestSchema = z.object({
  sessionId: UploadSessionIdSchema,
  pageIds: z.array(UploadPageIdSchema).min(1).max(80),
});

// slug는 독자 URL과 SEO의 기준이므로 표시 정보만 부분 수정한다.
export const UpdateSeriesInfoRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    synopsis: z.string().trim().min(1).max(1000).optional(),
  })
  .refine(
    (value) => value.title !== undefined || value.synopsis !== undefined,
    { message: "수정할 항목을 한 가지 이상 보내 주세요." },
  );

export const SeriesInfoResponseSchema = z.object({
  seriesId: z.string(),
  slug: z.string(),
  title: z.string(),
  synopsis: z.string(),
});

export const CreateSeriesRequestSchema = z.object({
  requestKey: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "slug는 영문 소문자, 숫자, 하이픈만 쓸 수 있어요.",
    ),
  title: z
    .string("작품 제목을 입력해 주세요.")
    .trim()
    .min(1, "작품 제목을 입력해 주세요.")
    .max(80, "작품 제목은 80자 이하로 입력해 주세요."),
  synopsis: z
    .string("줄거리를 입력해 주세요.")
    .trim()
    .min(1, "줄거리를 입력해 주세요.")
    .max(1000, "줄거리는 1000자 이하로 입력해 주세요."),
  genre: z
    .string("장르를 입력해 주세요.")
    .trim()
    .min(1, "장르를 입력해 주세요.")
    .max(40, "장르는 40자 이하로 입력해 주세요."),
  weekday: z.enum(
    ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    "연재 요일을 선택해 주세요.",
  ),
  authorName: z
    .string("작가 이름을 입력해 주세요.")
    .trim()
    .min(1, "작가 이름을 입력해 주세요.")
    .max(40, "작가 이름은 40자 이하로 입력해 주세요."),
});

export const CreateSeriesResponseSchema = z.object({
  seriesId: z.string(),
  slug: z.string(),
  title: z.string(),
  seasonId: z.string(),
});

export const SeasonStatusSchema = z.enum(["ongoing", "completed"]);

export const UpdateSeasonStatusRequestSchema = z.object({
  status: SeasonStatusSchema,
});

export const StudioSeasonResponseSchema = z.object({
  seasonId: z.string(),
  seriesId: z.string(),
  number: z.number().int().positive(),
  status: SeasonStatusSchema,
});

export const StudioSeriesSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  coverUrl: z.string().nullable(),
  seasons: z.array(
    z.object({
      id: z.string(),
      number: z.number().int().positive(),
      title: z.string().nullable(),
      status: SeasonStatusSchema,
      episodeCount: z.number().int().min(0),
    }),
  ),
});

export const StudioSeriesListSchema = z.object({
  items: z.array(StudioSeriesSummarySchema),
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
  requestKey: z.string().uuid(),
  sessionId: UploadSessionIdSchema,
  pageIds: z.array(UploadPageIdSchema).min(1).max(80),
  applicantName: z
    .string("신청자 이름을 입력해 주세요.")
    .trim()
    .min(2, "신청자 이름은 2자 이상 입력해 주세요.")
    .max(40, "신청자 이름은 40자 이하로 입력해 주세요."),
  bookTitle: z
    .string("책 제목을 입력해 주세요.")
    .trim()
    .min(1, "책 제목을 입력해 주세요.")
    .max(80, "책 제목은 80자 이하로 입력해 주세요."),
  bookSize: PackagingBookSizeSchema,
  coverType: PackagingCoverTypeSchema,
  quantity: z
    .number("수량은 숫자로 입력해 주세요.")
    .int("수량은 정수로 입력해 주세요.")
    .min(1, "수량은 1권 이상 입력해 주세요.")
    .max(500, "수량은 한 번에 500권까지 신청할 수 있어요."),
  memo: z
    .string()
    .trim()
    .max(500, "메모는 500자 이하로 적어 주세요.")
    .nullable()
    .optional(),
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

// received는 접수 시 시작 상태이므로 전이 대상에서 제외한다.
export const UpdatePackagingStatusRequestSchema = z.object({
  status: z.enum(["reviewing", "completed", "canceled"]),
});

export const AccessPolicySchema = z.object({
  freeVolumeCount: z
    .number("무료 공개 권 수는 숫자로 입력해 주세요.")
    .int("무료 공개 권 수는 정수로 입력해 주세요.")
    .min(0, "무료 공개 권 수는 0 이상 입력해 주세요.")
    .max(20, "무료 공개 권 수는 20 이하로 입력해 주세요."),
  previewEpisodeCount: z
    .number("미리보기 회차 수는 숫자로 입력해 주세요.")
    .int("미리보기 회차 수는 정수로 입력해 주세요.")
    .min(0, "미리보기 회차 수는 0 이상 입력해 주세요.")
    .max(4, "미리보기 회차 수는 4 이하로 입력해 주세요."),
});

export const AccessPolicyResponseSchema = AccessPolicySchema.extend({
  seriesId: z.string(),
});

export type EpisodeVisibility = z.infer<typeof EpisodeVisibilitySchema>;
export type ReplaceEpisodePagesRequest = z.infer<
  typeof ReplaceEpisodePagesRequestSchema
>;
export type UpdateSeriesInfoRequest = z.infer<
  typeof UpdateSeriesInfoRequestSchema
>;
export type SeriesInfoResponse = z.infer<typeof SeriesInfoResponseSchema>;
export type UpdateEpisodeRequest = z.infer<typeof UpdateEpisodeRequestSchema>;
export type SeriesCoverResponse = z.infer<typeof SeriesCoverResponseSchema>;
export type CreateSeriesRequest = z.infer<typeof CreateSeriesRequestSchema>;
export type CreateSeriesResponse = z.infer<
  typeof CreateSeriesResponseSchema
>;
export type SeasonStatus = z.infer<typeof SeasonStatusSchema>;
export type StudioSeasonResponse = z.infer<
  typeof StudioSeasonResponseSchema
>;
export type DraftEpisode = z.infer<typeof DraftEpisodeSchema>;
export type StudioSeriesSummary = z.infer<typeof StudioSeriesSummarySchema>;
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
