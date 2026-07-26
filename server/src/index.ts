import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./app";
import { PrismaReaderRepository } from "./repositories/reader-repository";
import { PrismaOrderRepository } from "./repositories/order-repository";
import { createPrintProvider } from "./printing/mock-print-provider";
import { OrderService } from "./services/order-service";
import { PrismaStudioRepository } from "./repositories/studio-repository";
import { createStudioStorage } from "./uploads/studio-storage-factory";
import { StudioService } from "./services/studio-service";
import {
  createApiKeyGuard,
  parseApiSecurityMode,
} from "./security/api-key-guard";
import { createSharedRateLimitStore } from "./security/rate-limit-store";
import { createMalwareScanner } from "./security/malware-scanner";
import { PrismaSecurityAuditLogger } from "./security/audit-logger";
import { resolveAuditHashSecret } from "./security/audit-hash-secret";
import { PrismaCandyRepository } from "./repositories/candy-repository";
import { CandyService } from "./services/candy-service";
import { createRealtimeService } from "./realtime/realtime-service";
import { DemoBotService } from "./realtime/demo-bot-service";
import type { DemoBotSpeed } from "./contracts/demo-bot";

const PORT = Number(process.env.PORT ?? 4000);
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "data", "uploads");

async function main() {
  const prisma = new PrismaClient();
  const printProvider = createPrintProvider();
  const studioStorage = createStudioStorage(UPLOAD_DIR);
  const malwareScanner = createMalwareScanner();
  const securityMode = parseApiSecurityMode(process.env.API_SECURITY_MODE);
  const auditHashSecret = resolveAuditHashSecret(
    securityMode,
    process.env.AUDIT_HASH_SECRET,
  );
  const rateLimitStore = await createSharedRateLimitStore(
    process.env.REDIS_URL,
  );
  const realtime = await createRealtimeService(process.env.REDIS_URL);
  const readerRepository = new PrismaReaderRepository(prisma);
  const orderService = new OrderService(
    new PrismaOrderRepository(prisma),
    printProvider,
  );
  const configuredBotCount = Number(process.env.REALTIME_BOT_READER_COUNT ?? 8);
  const botSpeed = ["slow", "normal", "fast"].includes(
    process.env.REALTIME_BOT_SPEED ?? "",
  )
    ? (process.env.REALTIME_BOT_SPEED as DemoBotSpeed)
    : "normal";
  const demoBot = new DemoBotService(
    readerRepository,
    orderService,
    realtime,
    {
      available:
        securityMode === "demo" &&
        process.env.REALTIME_BOT_ENABLED === "true",
      autoStart: process.env.REALTIME_BOT_AUTO_START !== "false",
      readerCount: Number.isInteger(configuredBotCount)
        ? Math.max(0, Math.min(30, configuredBotCount))
        : 8,
      speed: botSpeed,
    },
  );
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const auditLogger = new PrismaSecurityAuditLogger(prisma, auditHashSecret);
  const app = createApp({
    readerRepository,
    printProvider,
    orderService,
    candyService: new CandyService(new PrismaCandyRepository(prisma)),
    studioService: new StudioService(
      new PrismaStudioRepository(prisma),
      studioStorage,
      malwareScanner,
    ),
    uploadDir: UPLOAD_DIR,
    allowedOrigins,
    auditLogger,
    uploadRateLimitStore: rateLimitStore.store,
    realtime,
    demoBot,
    studioMutationGuard: createApiKeyGuard({
      mode: securityMode,
      expectedKey: process.env.STUDIO_API_KEY,
      headerName: "x-sweettoon-studio-key",
      code: "STUDIO_ACCESS_DENIED",
      message: "작가 스튜디오 접근 키를 확인해 주세요.",
    }),
    operationsGuard: createApiKeyGuard({
      mode: securityMode,
      expectedKey: process.env.OPERATIONS_API_KEY,
      headerName: "x-sweettoon-operations-key",
      code: "OPERATIONS_ACCESS_DENIED",
      message: "운영자 접근 키를 확인해 주세요.",
    }),
  });

  const server = app.listen(PORT, () => {
    console.log(
      `[sweettoon-server] listening on :${PORT} security=${securityMode} malware=${malwareScanner.name}`,
    );
    demoBot.start();
  });
  const shutdown = async () => {
    server.close();
    await Promise.allSettled([
      rateLimitStore.close(),
      demoBot.close(),
      realtime.close(),
      prisma.$disconnect(),
    ]);
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}

void main().catch((error) => {
  console.error("[sweettoon-server] failed to start", error);
  process.exitCode = 1;
});
