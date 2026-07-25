import crypto from "node:crypto";
import type { RequestHandler } from "express";

export type ApiSecurityMode = "demo" | "strict";

export type ApiKeyGuardOptions = {
  mode: ApiSecurityMode;
  expectedKey?: string;
  headerName: "x-sweettoon-studio-key" | "x-sweettoon-operations-key";
  code: string;
  message: string;
};

function keysMatch(expected: string, supplied: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    crypto.timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export function createApiKeyGuard({
  mode,
  expectedKey,
  headerName,
  code,
  message,
}: ApiKeyGuardOptions): RequestHandler {
  if (mode === "strict" && !expectedKey) {
    throw new Error(`${headerName} must be configured in strict mode`);
  }

  return (req, res, next) => {
    if (mode === "demo") {
      next();
      return;
    }
    const supplied = req.get(headerName);
    if (!supplied || !expectedKey || !keysMatch(expectedKey, supplied)) {
      res.status(401).json({ code, message });
      return;
    }
    next();
  };
}

export function parseApiSecurityMode(
  value: string | undefined,
): ApiSecurityMode {
  if (!value || value === "demo") return "demo";
  if (value === "strict") return "strict";
  throw new Error("API_SECURITY_MODE must be demo or strict");
}
