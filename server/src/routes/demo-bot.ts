import { Router, type RequestHandler } from "express";
import {
  DemoBotStatusSchema,
  DemoBotUpdateSchema,
} from "../contracts/demo-bot";
import type { DemoBotController } from "../realtime/demo-bot-service";
import {
  NoopSecurityAuditLogger,
  auditSecurityAction,
  type SecurityAuditLogger,
} from "../security/audit-logger";

const allowRequest: RequestHandler = (_req, _res, next) => next();

export function createDemoBotRouter(
  bot: DemoBotController,
  operationsGuard: RequestHandler = allowRequest,
  auditLogger: SecurityAuditLogger = new NoopSecurityAuditLogger(),
): Router {
  const router = Router();

  router.get("/realtime/demo-bot", (_req, res) => {
    res.json(DemoBotStatusSchema.parse(bot.status()));
  });

  router.patch(
    "/realtime/demo-bot",
    auditSecurityAction(auditLogger, "operations.demo-bot.update"),
    operationsGuard,
    async (req, res) => {
      const input = DemoBotUpdateSchema.safeParse(req.body);
      if (!input.success) {
        res.status(400).json({
          code: "INVALID_DEMO_BOT_CONFIGURATION",
          message: "봇 인원과 실행 속도를 다시 확인해 주세요.",
        });
        return;
      }
      res.json(DemoBotStatusSchema.parse(await bot.update(input.data)));
    },
  );

  router.post(
    "/realtime/demo-bot/reset",
    auditSecurityAction(auditLogger, "operations.demo-bot.reset"),
    operationsGuard,
    async (_req, res) => {
      res.json(DemoBotStatusSchema.parse(await bot.reset()));
    },
  );

  return router;
}
