import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import type { ReaderRepository } from "./repositories/reader-repository";
import { createReaderRouter } from "./routes/reader";
import {
  createPrintProvider,
} from "./printing/mock-print-provider";
import type { PrintProvider } from "./printing/print-provider";

export type AppOptions = {
  readerRepository: ReaderRepository;
  printProvider?: PrintProvider;
  uploadDir?: string;
};

export function createApp({
  readerRepository,
  printProvider = createPrintProvider(),
  uploadDir = path.join(process.cwd(), "data", "uploads"),
}: AppOptions): Express {
  const app = express();
  fs.mkdirSync(uploadDir, { recursive: true });

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, printProvider: printProvider.name });
  });

  app.use(
    "/api/images",
    express.static(uploadDir, {
      fallthrough: false,
      setHeaders(res) {
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );
  app.use("/api", createReaderRouter(readerRepository));

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "잠시 문제가 생겼습니다. 다시 시도해 주세요.",
      });
    },
  );

  return app;
}
