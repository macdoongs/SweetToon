import { resolveAuditHashSecret } from "./audit-hash-secret";

describe("resolveAuditHashSecret", () => {
  it("generates an unpredictable process secret when demo mode has no value", () => {
    const first = resolveAuditHashSecret("demo", undefined);
    const second = resolveAuditHashSecret("demo", undefined);

    expect(first).toHaveLength(64);
    expect(second).toHaveLength(64);
    expect(first).not.toBe(second);
  });

  it("keeps an explicitly configured demo secret", () => {
    expect(resolveAuditHashSecret("demo", "local-test-secret")).toBe(
      "local-test-secret",
    );
  });

  it("rejects a missing or short strict secret", () => {
    expect(() => resolveAuditHashSecret("strict", undefined)).toThrow(
      "AUDIT_HASH_SECRET must contain at least 32 characters in strict mode",
    );
    expect(() => resolveAuditHashSecret("strict", "too-short")).toThrow(
      "AUDIT_HASH_SECRET must contain at least 32 characters in strict mode",
    );
  });

  it("accepts a sufficiently long strict secret", () => {
    const secret = "a".repeat(32);

    expect(resolveAuditHashSecret("strict", secret)).toBe(secret);
  });
});
