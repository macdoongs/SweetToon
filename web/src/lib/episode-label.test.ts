import { describe, expect, it } from "vitest";

import { episodeLabel } from "./episode-label";

describe("episodeLabel", () => {
  it("does not repeat a title that already matches the episode number", () => {
    expect(episodeLabel(12, "12화")).toBe("12화");
    expect(episodeLabel(12, " 12화 ")).toBe("12화");
  });

  it("keeps a descriptive title next to the episode number", () => {
    expect(episodeLabel(12, "비 오는 날의 약속")).toBe(
      "12화 - 비 오는 날의 약속",
    );
  });
});
