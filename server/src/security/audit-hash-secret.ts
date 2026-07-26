import { randomBytes } from "node:crypto";
import type { ApiSecurityMode } from "./api-key-guard";

const MINIMUM_STRICT_SECRET_LENGTH = 32;

export function resolveAuditHashSecret(
  mode: ApiSecurityMode,
  configuredSecret: string | undefined,
): string {
  if (mode === "strict") {
    if (
      !configuredSecret ||
      configuredSecret.length < MINIMUM_STRICT_SECRET_LENGTH
    ) {
      throw new Error(
        "AUDIT_HASH_SECRET must contain at least 32 characters in strict mode",
      );
    }
    return configuredSecret;
  }

  return configuredSecret || randomBytes(32).toString("hex");
}
