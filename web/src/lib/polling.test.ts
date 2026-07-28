import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startBackoffPolling } from "./polling";

describe("startBackoffPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("실패가 이어지면 간격을 2배씩 늘리고 상한에서 멈춘다", async () => {
    const task = vi.fn().mockResolvedValue(false);
    const stop = startBackoffPolling(task, {
      intervalMs: 1_000,
      maxIntervalMs: 4_000,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(task).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(task).toHaveBeenCalledTimes(3);
    // 상한 4초 유지
    await vi.advanceTimersByTimeAsync(4_000);
    expect(task).toHaveBeenCalledTimes(4);
    stop();
  });

  it("성공하면 기본 간격으로 되돌리고 stop 이후에는 실행하지 않는다", async () => {
    const results = [false, true, true];
    const task = vi.fn(() => Promise.resolve(results.shift() ?? true));
    const stop = startBackoffPolling(task, {
      intervalMs: 1_000,
      maxIntervalMs: 8_000,
    });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2_000); // 실패 후 backoff
    expect(task).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_000); // 성공 후 기본 간격 복귀
    expect(task).toHaveBeenCalledTimes(3);

    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("task가 reject 되어도 실패로 간주하고 계속 돈다", async () => {
    const task = vi.fn().mockRejectedValue(new Error("boom"));
    const stop = startBackoffPolling(task, {
      intervalMs: 1_000,
      maxIntervalMs: 2_000,
    });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
  });
});
