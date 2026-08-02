import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
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
import type { RequestHandler } from "express";
import type { Store } from "express-rate-limit";
import type { SecurityAuditLogger } from "./security/audit-logger";
import { createCandyRouter } from "./routes/candy";
import {
  CandyServiceError,
  type CandyUseCases,
} from "./services/candy-service";
import type { RealtimeService } from "./realtime/realtime-service";
import { createRealtimeRouter } from "./routes/realtime";
import type { DemoBotController } from "./realtime/demo-bot-service";
import { DemoBotUnavailableError } from "./realtime/demo-bot-service";
import { createDemoBotRouter } from "./routes/demo-bot";
import { createEpisodeLikeRouter } from "./routes/episode-like";
import {
  EpisodeLikeServiceError,
  type EpisodeLikeUseCases,
} from "./services/episode-like-service";

const READINESS_TIMEOUT_MS = 2_000;

async function checkReadiness(
  readinessCheck: () => Promise<void>,
): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      readinessCheck(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("readiness check timed out")),
          READINESS_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export type AppOptions = {
  readerRepository: ReaderRepository;
  printProvider?: PrintProvider;
  orderService?: OrderUseCases;
  candyService?: CandyUseCases;
  episodeLikeService?: EpisodeLikeUseCases;
  studioService?: StudioUseCases;
  uploadDir?: string;
  allowedOrigins?: string[];
  studioMutationGuard?: RequestHandler;
  operationsGuard?: RequestHandler;
  uploadRateLimitStore?: Store;
  auditLogger?: SecurityAuditLogger;
  realtime?: RealtimeService;
  demoBot?: DemoBotController;
  readinessCheck?: () => Promise<void>;
};

export function createApp({
  readerRepository,
  printProvider = createPrintProvider(),
  orderService,
  candyService,
  episodeLikeService,
  studioService,
  uploadDir = path.join(process.cwd(), "data", "uploads"),
  allowedOrigins = [],
  studioMutationGuard,
  operationsGuard,
  uploadRateLimitStore,
  auditLogger,
  realtime,
  demoBot,
  readinessCheck,
}: AppOptions): Express {
  const app = express();
  fs.mkdirSync(uploadDir, { recursive: true });

  app.set("trust proxy", 1);
  const defaultSecurityHeaders = helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
  const swaggerSecurityHeaders = helmet({
    // Swagger UI uses an inline bootstrap script.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
  app.use((req, res, next) => {
    const securityHeaders = req.path.startsWith("/api-docs")
      ? swaggerSecurityHeaders
      : defaultSecurityHeaders;
    securityHeaders(req, res, next);
  });
  app.use(
    cors({
      credentials: false,
      origin(origin, callback) {
        callback(
          null,
          !origin || allowedOrigins.includes(origin),
        );
      },
    }),
  );
  app.use(express.json());

  const live = (_req: express.Request, res: express.Response) => {
    res.json({ ok: true, printProvider: printProvider.name });
  };
  app.get(["/health", "/health/live"], live);
  app.get("/health/ready", async (_req, res) => {
    try {
      if (readinessCheck) await checkReadiness(readinessCheck);
      res.json({
        ok: true,
        dependencies: readinessCheck ? "ready" : "not-configured",
        printProvider: printProvider.name,
      });
    } catch (error) {
      console.error("[sweettoon-readiness]", error);
      res.status(503).json({
        ok: false,
        dependencies: "unavailable",
        printProvider: printProvider.name,
      });
    }
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
  if (realtime) {
    app.use("/api", createRealtimeRouter(readerRepository, realtime));
  }
  if (demoBot) {
    app.use(
      "/api",
      createDemoBotRouter(demoBot, operationsGuard, auditLogger),
    );
  }
  if (orderService) {
    app.use(
      "/api",
      createOrderRouter(orderService, {
        operationsGuard,
        auditLogger,
        realtime,
      }),
    );
  }
  if (candyService) {
    app.use("/api", createCandyRouter(candyService));
  }
  if (episodeLikeService) {
    app.use("/api", createEpisodeLikeRouter(episodeLikeService));
  }
  if (studioService) {
    app.use(
      "/api",
      createStudioRouter(studioService, {
        mutationGuard: studioMutationGuard,
        operationsGuard,
        rateLimitStore: uploadRateLimitStore,
        auditLogger,
      }),
    );
  }

  app.use("/api", (_req, res) => {
    res.status(404).json({
      code: "API_NOT_FOUND",
      message: "요청한 API를 찾을 수 없습니다.",
    });
  });

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
      if (error instanceof CandyServiceError) {
        res.status(error.status).json({
          code: error.code,
          message: error.message,
        });
        return;
      }
      if (error instanceof EpisodeLikeServiceError) {
        res.status(error.status).json({
          code: error.code,
          message: error.message,
        });
        return;
      }
      if (error instanceof DemoBotUnavailableError) {
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
      if (
        error instanceof SyntaxError &&
        "type" in error &&
        error.type === "entity.parse.failed"
      ) {
        res.status(400).json({
          code: "INVALID_JSON",
          message: "JSON 요청 본문이 올바르지 않습니다.",
        });
        return;
      }
      if (error instanceof multer.MulterError) {
        const isCover = error.field === "cover";
        res.status(400).json({
          code: isCover
            ? "COVER_UPLOAD_REJECTED"
            : "ARCHIVE_UPLOAD_REJECTED",
          message:
            error.code === "LIMIT_FILE_SIZE"
              ? isCover
                ? "표지 이미지는 5MB 이하로 올려 주세요."
                : "ZIP 파일은 25MB 이하로 올려 주세요."
              : isCover
                ? "표지 이미지 하나만 올려 주세요."
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
