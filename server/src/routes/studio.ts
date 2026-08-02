import path from "node:path";
import { Router, type RequestHandler } from "express";
import multer from "multer";
import { rateLimit, type Store } from "express-rate-limit";
import { z } from "zod";
import {
  AccessPolicyResponseSchema,
  AccessPolicySchema,
  CreatedEpisodeSchema,
  CreateEpisodeRequestSchema,
  CreatePackagingRequestSchema,
  CreateSeriesRequestSchema,
  CreateSeriesResponseSchema,
  DraftEpisodeListSchema,
  DraftEpisodeSchema,
  PackagingRequestListSchema,
  PackagingRequestSchema,
  ReplaceEpisodePagesRequestSchema,
  SeriesCoverResponseSchema,
  SeriesInfoResponseSchema,
  StudioSeasonResponseSchema,
  StudioSeriesListSchema,
  UpdateEpisodeRequestSchema,
  UpdateEpisodeVisibilityRequestSchema,
  UpdatePackagingStatusRequestSchema,
  UpdateSeasonStatusRequestSchema,
  UpdateSeriesInfoRequestSchema,
  UploadPageIdSchema,
  UploadPreviewSchema,
  UploadSessionIdSchema,
} from "../contracts/studio";
import { fieldIssueMessage } from "../contracts/validation";
import { ARCHIVE_LIMITS } from "../uploads/archive-analyzer";
import { COVER_MAX_BYTES } from "../uploads/cover-image";
import type { StudioUseCases } from "../services/studio-service";
import {
  NoopSecurityAuditLogger,
  auditSecurityAction,
  type SecurityAuditLogger,
} from "../security/audit-logger";

const episodeFieldLabels = {
  number: "회차 번호",
  title: "회차 제목",
};

const seriesFieldLabels = {
  slug: "slug",
  title: "작품 제목",
  synopsis: "줄거리",
  genre: "장르",
  weekday: "연재 요일",
  authorName: "작가 이름",
};

const packagingFieldLabels = {
  applicantName: "신청자 이름",
  bookTitle: "책 제목",
  bookSize: "판형",
  coverType: "표지",
  quantity: "수량",
  memo: "메모",
};

const accessPolicyFieldLabels = {
  freeVolumeCount: "무료 공개 권 수",
  previewEpisodeCount: "미리보기 회차 수",
};

const archiveUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: ARCHIVE_LIMITS.maxArchiveBytes,
    files: 1,
    fields: 0,
  },
});

const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: COVER_MAX_BYTES,
    files: 1,
    fields: 0,
  },
});

type StudioRouterOptions = {
  mutationGuard?: RequestHandler;
  operationsGuard?: RequestHandler;
  rateLimitStore?: Store;
  auditLogger?: SecurityAuditLogger;
};

const allowRequest: RequestHandler = (_req, _res, next) => next();

export function createStudioRouter(
  service: StudioUseCases,
  {
    mutationGuard = allowRequest,
    operationsGuard = allowRequest,
    rateLimitStore,
    auditLogger = new NoopSecurityAuditLogger(),
  }: StudioRouterOptions = {},
): Router {
  const router = Router();
  const uploadRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    store: rateLimitStore,
    passOnStoreError: false,
    handler: (_req, res) => {
      res.status(429).json({
        code: "UPLOAD_RATE_LIMITED",
        message: "짧은 시간에 업로드가 너무 많아요. 잠시 뒤 다시 시도해 주세요.",
      });
    },
  });

  router.post(
    "/studio/uploads",
    auditSecurityAction(auditLogger, "studio.upload.preview"),
    mutationGuard,
    uploadRateLimit,
    archiveUpload.single("archive"),
    async (req, res) => {
      if (!req.file) {
        res.status(400).json({
          code: "ARCHIVE_REQUIRED",
          message: "ZIP 또는 CBZ 파일을 선택해 주세요.",
        });
        return;
      }
      const extension = path.extname(req.file.originalname).toLowerCase();
      if (extension !== ".zip" && extension !== ".cbz") {
        res.status(400).json({
          code: "ARCHIVE_EXTENSION_INVALID",
          message: "확장자가 .zip 또는 .cbz인 파일만 올릴 수 있습니다.",
        });
        return;
      }
      const preview = await service.previewArchive(
        req.file.originalname,
        req.file.buffer,
      );
      res.status(201).json(UploadPreviewSchema.parse(preview));
    },
  );

  router.get(
    "/studio/uploads/:sessionId/pages/:pageId",
    async (req, res) => {
      const sessionId = UploadSessionIdSchema.safeParse(req.params.sessionId);
      const pageId = UploadPageIdSchema.safeParse(req.params.pageId);
      if (!sessionId.success || !pageId.success) {
        res.status(400).json({
          code: "INVALID_PREVIEW_ID",
          message: "미리보기 주소가 올바르지 않습니다.",
        });
        return;
      }
      const filePath = await service.getPreviewPath(
        sessionId.data,
        pageId.data,
      );
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.sendFile(filePath);
    },
  );

  router.post(
    "/studio/episodes",
    auditSecurityAction(auditLogger, "studio.episode.publish"),
    mutationGuard,
    async (req, res) => {
      const input = CreateEpisodeRequestSchema.safeParse(req.body);
      if (!input.success) {
        res.status(400).json({
          code: "INVALID_EPISODE",
          message: fieldIssueMessage(
            input.error,
            episodeFieldLabels,
            "시즌, 회차, 제목과 페이지 순서를 다시 확인해 주세요.",
          ),
        });
        return;
      }
      const created = await service.createEpisode(input.data);
      res.status(201).json(CreatedEpisodeSchema.parse(created));
    },
  );

  router.patch(
    "/studio/episodes/:episodeId/visibility",
    auditSecurityAction(auditLogger, "studio.episode.visibility"),
    mutationGuard,
    async (req, res) => {
      const episodeId = z
        .string()
        .min(1)
        .max(80)
        .safeParse(req.params.episodeId);
      const input = UpdateEpisodeVisibilityRequestSchema.safeParse(req.body);
      if (!episodeId.success || !input.success) {
        res.status(400).json({
          code: "INVALID_EPISODE_VISIBILITY",
          message: "에피소드와 공개 상태 값을 다시 확인해 주세요.",
        });
        return;
      }
      const updated = await service.setEpisodeVisibility(
        episodeId.data,
        input.data.visibility,
      );
      res.json(DraftEpisodeSchema.parse(updated));
    },
  );

  router.patch(
    "/studio/episodes/:episodeId",
    auditSecurityAction(auditLogger, "studio.episode.update"),
    mutationGuard,
    async (req, res) => {
      const episodeId = z
        .string()
        .min(1)
        .max(80)
        .safeParse(req.params.episodeId);
      const input = UpdateEpisodeRequestSchema.safeParse(req.body);
      if (!episodeId.success || !input.success) {
        res.status(400).json({
          code: "INVALID_EPISODE_UPDATE",
          message: input.success
            ? "에피소드 주소가 올바르지 않습니다."
            : fieldIssueMessage(
                input.error,
                episodeFieldLabels,
                "제목(80자 이하)이나 회차 번호(1 이상)를 한 가지 이상 보내 주세요.",
              ),
        });
        return;
      }
      const updated = await service.updateEpisode(
        episodeId.data,
        input.data,
      );
      res.json(DraftEpisodeSchema.parse(updated));
    },
  );

  router.post(
    "/studio/series/:seriesId/cover",
    auditSecurityAction(auditLogger, "studio.series.cover"),
    mutationGuard,
    coverUpload.single("cover"),
    async (req, res) => {
      const seriesId = z
        .string()
        .min(1)
        .max(80)
        .safeParse(req.params.seriesId);
      if (!seriesId.success || !req.file) {
        res.status(400).json({
          code: "COVER_REQUIRED",
          message: "표지로 쓸 이미지 파일을 선택해 주세요.",
        });
        return;
      }
      const updated = await service.updateSeriesCover(
        seriesId.data,
        req.file.buffer,
      );
      res.json(SeriesCoverResponseSchema.parse(updated));
    },
  );

  router.patch(
    "/studio/episodes/:episodeId/pages",
    auditSecurityAction(auditLogger, "studio.episode.replace-pages"),
    mutationGuard,
    async (req, res) => {
      const episodeId = z
        .string()
        .min(1)
        .max(80)
        .safeParse(req.params.episodeId);
      const input = ReplaceEpisodePagesRequestSchema.safeParse(req.body);
      if (!episodeId.success || !input.success) {
        res.status(400).json({
          code: "INVALID_PAGE_REPLACEMENT",
          message: "업로드 세션과 페이지 순서를 다시 확인해 주세요.",
        });
        return;
      }
      const replaced = await service.replaceEpisodePages(
        episodeId.data,
        input.data,
      );
      res.json(CreatedEpisodeSchema.parse(replaced));
    },
  );

  router.get("/studio/series", async (_req, res) => {
    res.json(
      StudioSeriesListSchema.parse({
        items: await service.listStudioSeries(),
      }),
    );
  });

  router.get("/studio/drafts", async (_req, res) => {
    res.json(
      DraftEpisodeListSchema.parse({
        items: await service.listDraftEpisodes(),
      }),
    );
  });

  router.post(
    "/studio/packaging-requests",
    auditSecurityAction(auditLogger, "studio.packaging.request"),
    mutationGuard,
    async (req, res) => {
      const input = CreatePackagingRequestSchema.safeParse(req.body);
      if (!input.success) {
        res.status(400).json({
          code: "INVALID_PACKAGING_REQUEST",
          message: fieldIssueMessage(
            input.error,
            packagingFieldLabels,
            "신청자, 책 제목, 판형과 페이지 순서를 다시 확인해 주세요.",
          ),
        });
        return;
      }
      const created = await service.createPackagingRequest(input.data);
      res.status(201).json(PackagingRequestSchema.parse(created));
    },
  );

  router.patch(
    "/studio/seasons/:seasonId/status",
    auditSecurityAction(auditLogger, "studio.season.status"),
    mutationGuard,
    async (req, res) => {
      const seasonId = z
        .string()
        .min(1)
        .max(80)
        .safeParse(req.params.seasonId);
      const input = UpdateSeasonStatusRequestSchema.safeParse(req.body);
      if (!seasonId.success || !input.success) {
        res.status(400).json({
          code: "INVALID_SEASON_STATUS",
          message: "시즌과 상태 값을 다시 확인해 주세요.",
        });
        return;
      }
      const updated = await service.updateSeasonStatus(
        seasonId.data,
        input.data.status,
      );
      res.json(StudioSeasonResponseSchema.parse(updated));
    },
  );

  router.post(
    "/studio/series/:seriesId/seasons",
    auditSecurityAction(auditLogger, "studio.season.create"),
    mutationGuard,
    async (req, res) => {
      const seriesId = z
        .string()
        .min(1)
        .max(80)
        .safeParse(req.params.seriesId);
      if (!seriesId.success) {
        res.status(400).json({
          code: "INVALID_SERIES_ID",
          message: "작품 주소가 올바르지 않습니다.",
        });
        return;
      }
      const created = await service.createSeason(seriesId.data);
      res.status(201).json(StudioSeasonResponseSchema.parse(created));
    },
  );

  router.patch(
    "/studio/packaging-requests/:requestId/status",
    auditSecurityAction(auditLogger, "studio.packaging.status"),
    operationsGuard,
    async (req, res) => {
      const requestId = z
        .string()
        .min(1)
        .max(80)
        .safeParse(req.params.requestId);
      const input = UpdatePackagingStatusRequestSchema.safeParse(req.body);
      if (!requestId.success || !input.success) {
        res.status(400).json({
          code: "INVALID_PACKAGING_STATUS",
          message: "신청과 상태 값을 다시 확인해 주세요.",
        });
        return;
      }
      const updated = await service.updatePackagingStatus(
        requestId.data,
        input.data.status,
      );
      res.json(PackagingRequestSchema.parse(updated));
    },
  );

  router.get("/studio/packaging-requests", async (_req, res) => {
    res.json(
      PackagingRequestListSchema.parse({
        items: await service.listPackagingRequests(),
      }),
    );
  });

  router.post(
    "/studio/series",
    auditSecurityAction(auditLogger, "studio.series.create"),
    mutationGuard,
    async (req, res) => {
      const input = CreateSeriesRequestSchema.safeParse(req.body);
      if (!input.success) {
        res.status(400).json({
          code: "INVALID_SERIES",
          message: fieldIssueMessage(
            input.error,
            seriesFieldLabels,
            "slug(영문 소문자·숫자·하이픈), 제목, 줄거리, 장르, 요일, 작가 이름을 다시 확인해 주세요.",
          ),
        });
        return;
      }
      const created = await service.createSeries(input.data);
      res.status(201).json(CreateSeriesResponseSchema.parse(created));
    },
  );

  router.delete(
    "/studio/episodes/:episodeId",
    auditSecurityAction(auditLogger, "studio.episode.delete"),
    mutationGuard,
    async (req, res) => {
      const episodeId = z
        .string()
        .min(1)
        .max(80)
        .safeParse(req.params.episodeId);
      if (!episodeId.success) {
        res.status(400).json({
          code: "INVALID_EPISODE_ID",
          message: "에피소드 주소가 올바르지 않습니다.",
        });
        return;
      }
      await service.deleteEpisode(episodeId.data);
      res.status(204).end();
    },
  );

  router.patch(
    "/studio/series/:seriesId",
    auditSecurityAction(auditLogger, "studio.series.update"),
    mutationGuard,
    async (req, res) => {
      const seriesId = z
        .string()
        .min(1)
        .max(80)
        .safeParse(req.params.seriesId);
      const input = UpdateSeriesInfoRequestSchema.safeParse(req.body);
      if (!seriesId.success || !input.success) {
        res.status(400).json({
          code: "INVALID_SERIES_INFO",
          message: input.success
            ? "작품 주소가 올바르지 않습니다."
            : fieldIssueMessage(
                input.error,
                seriesFieldLabels,
                "작품 제목(80자 이하)이나 줄거리(1000자 이하)를 다시 확인해 주세요.",
              ),
        });
        return;
      }
      const updated = await service.updateSeriesInfo(
        seriesId.data,
        input.data,
      );
      res.json(SeriesInfoResponseSchema.parse(updated));
    },
  );

  router.patch(
    "/studio/series/:seriesId/access-policy",
    auditSecurityAction(auditLogger, "studio.access-policy.update"),
    mutationGuard,
    async (req, res) => {
    const seriesId = z.string().min(1).max(80).safeParse(req.params.seriesId);
    const input = AccessPolicySchema.safeParse(req.body);
    if (!seriesId.success || !input.success) {
      res.status(400).json({
        code: "INVALID_ACCESS_POLICY",
        message: input.success
          ? "작품 주소가 올바르지 않습니다."
          : fieldIssueMessage(
              input.error,
              accessPolicyFieldLabels,
              "무료 공개 권 수와 미리보기 화 수를 다시 확인해 주세요.",
            ),
      });
      return;
    }
    res.json(
      AccessPolicyResponseSchema.parse(
        await service.updateAccessPolicy(seriesId.data, input.data),
      ),
    );
    },
  );

  router.delete(
    "/studio/uploads/:sessionId",
    auditSecurityAction(auditLogger, "studio.upload.cancel"),
    mutationGuard,
    async (req, res) => {
    const sessionId = UploadSessionIdSchema.safeParse(req.params.sessionId);
    if (!sessionId.success) {
      res.status(400).json({
        code: "INVALID_UPLOAD_SESSION",
        message: "업로드 세션 주소가 올바르지 않습니다.",
      });
      return;
    }
    await service.cancelUpload(sessionId.data);
    res.status(204).end();
    },
  );

  return router;
}
