import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearOrderAttempt,
  getOrCreateOrderAttempt,
} from "./order-attempt";

describe("order attempt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reuses the persisted key only for the same payload", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "request-1") });

    const first = getOrCreateOrderAttempt("attempt", { quantity: 1 }, null);
    const retried = getOrCreateOrderAttempt(
      "attempt",
      { quantity: 1 },
      null,
    );

    expect(retried).toEqual(first);
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it("creates a new key for changed content and can clear it", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("request-1")
        .mockReturnValueOnce("request-2"),
    });

    getOrCreateOrderAttempt("attempt", { quantity: 1 }, null);
    const changed = getOrCreateOrderAttempt(
      "attempt",
      { quantity: 2 },
      null,
    );
    clearOrderAttempt("attempt");

    expect(changed.requestKey).toBe("request-2");
    expect(values.has("attempt")).toBe(false);
  });
});
