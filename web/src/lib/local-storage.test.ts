import { afterEach, describe, expect, it, vi } from "vitest";
import { writeLocalStorage } from "./local-storage";

describe("writeLocalStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("저장 성공 여부를 반환한다", () => {
    const setItem = vi.fn();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { setItem });

    expect(writeLocalStorage("key", "value")).toBe(true);
    expect(setItem).toHaveBeenCalledWith("key", "value");
  });

  it("저장소 예외가 UI까지 전파되지 않게 막는다", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      setItem: vi.fn(() => {
        throw new DOMException("quota exceeded", "QuotaExceededError");
      }),
    });

    expect(writeLocalStorage("key", "value")).toBe(false);
  });
});
