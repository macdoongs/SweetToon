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
  DraftEpisodeListSchema,
  DraftEpisodeSchema,
  PackagingRequestListSchema,
  PackagingRequestSchema,
  ReplaceEpisodePagesRequestSchema,
  SeriesInfoResponseSchema,
  UpdateEpisodeTitleRequestSchema,
  UpdateEpisodeVisibilityRequestSchema,
  UpdateSeriesInfoRequestSchema,
  UploadPageIdSchema,
  UploadPreviewSchema,
  UploadSessionIdSchema,
} from "../contracts/studio";
import { ARCHIVE_LIMITS } from "../uploads/archive-analyzer";
import type { StudioUseCases } from "../services/studio-service";
import {
  NoopSecurityAuditLogger,
  auditSecurityAction,
  type SecurityAuditLogger,
} from "../security/audit-logger";

const archiveUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: ARCHIVE_LIMITS.maxArchiveBytes,
    files: 1,
    fields: 0,
  },
});

type StudioRouterOptions = {
  mutationGuard?: RequestHandler;
  rateLimitStore?: Store;
  auditLogger?: SecurityAuditLogger;
};

const allowRequest: RequestHandler = (_req, _res, next) => next();

export function createStudioRouter(
  service: StudioUseCases,
  {
    mutationGuard = allowRequest,
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
          message: "시즌, 회차, 제목과 페이지 순서를 다시 확인해 주세요.",
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
    "/studio/episodes/:episodeId/title",
    auditSecurityAction(auditLogger, "studio.episode.rename"),
    mutationGuard,
    async (req, res) => {
      const episodeId = z
        .string()
        .min(1)
        .max(80)
        .safeParse(req.params.episodeId);
      const input = UpdateEpisodeTitleRequestSchema.safeParse(req.body);
      if (!episodeId.success || !input.success) {
        res.status(400).json({
          code: "INVALID_EPISODE_TITLE",
          message: "에피소드 제목은 1자 이상 80자 이하로 입력해 주세요.",
        });
        return;
      }
      const updated = await service.updateEpisodeTitle(
        episodeId.data,
        input.data.title,
      );
      res.json(DraftEpisodeSchema.parse(updated));
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
          message: "신청자, 책 제목, 판형과 페이지 순서를 다시 확인해 주세요.",
        });
        return;
      }
      const created = await service.createPackagingRequest(input.data);
      res.status(201).json(PackagingRequestSchema.parse(created));
    },
  );

  router.get("/studio/packaging-requests", async (_req, res) => {
    res.json(
      PackagingRequestListSchema.parse({
        items: await service.listPackagingRequests(),
      }),
    );
  });

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
          message:
            "작품 제목(80자 이하)이나 줄거리(1000자 이하)를 다시 확인해 주세요.",
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
        message: "무료 공개 권 수와 미리보기 화 수를 다시 확인해 주세요.",
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
