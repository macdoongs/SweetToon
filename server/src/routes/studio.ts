import path from "node:path";
import { Router } from "express";
import multer from "multer";
import {
  CreatedEpisodeSchema,
  CreateEpisodeRequestSchema,
  UploadPageIdSchema,
  UploadPreviewSchema,
  UploadSessionIdSchema,
} from "../contracts/studio";
import { ARCHIVE_LIMITS } from "../uploads/archive-analyzer";
import type { StudioUseCases } from "../services/studio-service";

const archiveUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: ARCHIVE_LIMITS.maxArchiveBytes,
    files: 1,
    fields: 0,
  },
});

export function createStudioRouter(service: StudioUseCases): Router {
  const router = Router();

  router.post(
    "/studio/uploads",
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

  router.post("/studio/episodes", async (req, res) => {
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
  });

  router.delete("/studio/uploads/:sessionId", async (req, res) => {
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
  });

  return router;
}
