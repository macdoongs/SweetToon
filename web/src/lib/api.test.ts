import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, deleteRequest, getJson } from "./api";

describe("client API network handling", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("normalizes a network failure into a stable Korean error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    await expect(getJson("/api/example")).rejects.toMatchObject({
      name: "ApiError",
      code: "NETWORK_ERROR",
      status: 0,
      message: "네트워크 연결이 불안정합니다. 잠시 뒤 다시 시도해 주세요.",
    } satisfies Partial<ApiError>);
  });

  it("times out a request that never completes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_path: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      }),
    );

    const request = getJson("/api/slow");
    const assertion = expect(request).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      status: 0,
    });
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });

  it("rejects a truncated successful response with a stable error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(getJson("/api/example")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: 200,
    });
  });

  it("preserves a delete error code and Korean server message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "EPISODE_HAS_ENTITLEMENTS",
            message: "대신 비공개로 전환해 주세요.",
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(deleteRequest("/api/studio/episodes/1")).rejects.toMatchObject({
      code: "EPISODE_HAS_ENTITLEMENTS",
      message: "대신 비공개로 전환해 주세요.",
      status: 409,
    });
  });
});
