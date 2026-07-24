import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "express";

export type AuditEvent = {
  action: string;
  outcome: "allowed" | "rejected" | "failed";
  statusCode: number;
  ip?: string;
  userAgent?: string;
};

export interface SecurityAuditLogger {
  record(event: AuditEvent): Promise<void>;
}

export class NoopSecurityAuditLogger implements SecurityAuditLogger {
  async record(_event: AuditEvent): Promise<void> {
    return undefined;
  }
}

export class PrismaSecurityAuditLogger implements SecurityAuditLogger {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly hashSecret: string,
  ) {}

  async record(event: AuditEvent): Promise<void> {
    const ipHash = event.ip
      ? crypto
          .createHmac("sha256", this.hashSecret)
          .update(event.ip)
          .digest("hex")
      : null;
    await this.prisma.securityAuditEvent.create({
      data: {
        action: event.action,
        outcome: event.outcome,
        statusCode: event.statusCode,
        ipHash,
        userAgent: event.userAgent?.slice(0, 255) ?? null,
      },
    });
  }
}

export function auditSecurityAction(
  logger: SecurityAuditLogger,
  action: string,
): RequestHandler {
  return (req, res, next) => {
    res.once("finish", () => {
      const statusCode = res.statusCode;
      const outcome =
        statusCode < 400
          ? "allowed"
          : statusCode < 500
            ? "rejected"
            : "failed";
      void logger
        .record({
          action,
          outcome,
          statusCode,
          ip: req.ip,
          userAgent: req.get("user-agent"),
        })
        .catch((error) => console.error("[sweettoon-audit]", error));
    });
    next();
  };
}
