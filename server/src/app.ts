import express, { type Express } from "express";
import cors from "cors";
import multer from "multer";
import swaggerUi from "swagger-ui-express";
import path from "node:path";
import fs from "node:fs";
import type { ReaderRepository } from "./repositories/reader-repository";
import { createReaderRouter } from "./routes/reader";
import { createPrintProvider } from "./printing/mock-print-provider";
import type { PrintProvider } from "./printing/print-provider";
import { createOrderRouter } from "./routes/order";
import {
  OrderServiceError,
  type OrderUseCases,
} from "./services/order-service";
import { createStudioRouter } from "./routes/studio";
import {
  StudioServiceError,
  type StudioUseCases,
} from "./services/studio-service";
import { openApiDocument } from "./openapi";

export type AppOptions = {
  readerRepository: ReaderRepository;
  printProvider?: PrintProvider;
  orderService?: OrderUseCases;
  studioService?: StudioUseCases;
  uploadDir?: string;
};

export function createApp({
  readerRepository,
  printProvider = createPrintProvider(),
  orderService,
  studioService,
  uploadDir = path.join(process.cwd(), "data", "uploads"),
}: AppOptions): Express {
  const app = express();
  fs.mkdirSync(uploadDir, { recursive: true });

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, printProvider: printProvider.name });
  });
  app.get("/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });
  const swaggerHtml = swaggerUi.generateHTML(openApiDocument, {
    customSiteTitle: "SweetToon API",
  });
  app.get(["/api-docs", "/api-docs/"], (_req, res) => {
    res.type("html").send(swaggerHtml);
  });
  app.use("/api-docs", swaggerUi.serve);

  app.use(
    "/api/images/studio",
    express.static(path.join(uploadDir, "studio"), {
      dotfiles: "ignore",
      fallthrough: false,
      immutable: true,
      maxAge: "1y",
      setHeaders(res) {
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );
  app.use(
    "/api/images",
    express.static(uploadDir, {
      dotfiles: "ignore",
      fallthrough: false,
      setHeaders(res) {
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );
  app.use("/api", createReaderRouter(readerRepository));
  if (orderService) {
    app.use("/api", createOrderRouter(orderService));
  }
  if (studioService) {
    app.use("/api", createStudioRouter(studioService));
  }

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof OrderServiceError) {
        res.status(error.status).json({
          code: error.code,
          message: error.message,
        });
        return;
      }
      if (error instanceof StudioServiceError) {
        res.status(error.status).json({
          code: error.code,
          message: error.message,
        });
        return;
      }
      if (error instanceof multer.MulterError) {
        res.status(400).json({
          code: "ARCHIVE_UPLOAD_REJECTED",
          message:
            error.code === "LIMIT_FILE_SIZE"
              ? "ZIP 파일은 25MB 이하로 올려 주세요."
              : "ZIP 파일 하나만 올려 주세요.",
        });
        return;
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        error.status === 404
      ) {
        res.status(404).json({
          code: "IMAGE_NOT_FOUND",
          message: "이미지를 찾을 수 없습니다.",
        });
        return;
      }
      console.error(error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "잠시 문제가 생겼습니다. 다시 시도해 주세요.",
      });
    },
  );

  return app;
}
