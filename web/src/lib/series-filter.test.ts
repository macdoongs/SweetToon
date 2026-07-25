import { describe, expect, it } from "vitest";

import {
  catalogHref,
  parseGenre,
  parseSeriesFilter,
  parseWeekday,
  seriesFilterQuery,
} from "./series-filter";

describe("catalog filter parsing", () => {
  it("accepts supported filters and uses the first query value", () => {
    expect(parseSeriesFilter("collectible")).toBe("collectible");
    expect(parseSeriesFilter(["ongoing", "all"])).toBe("ongoing");
    expect(parseWeekday("fri")).toBe("fri");
  });

  it("falls back safely for unsupported or oversized input", () => {
    expect(parseSeriesFilter("unknown")).toBe("all");
    expect(parseWeekday("holiday")).toBeUndefined();
    expect(parseGenre("가".repeat(41))).toBeUndefined();
  });
});

describe("catalog URL construction", () => {
  it("encodes active filters for the API query", () => {
    expect(
      seriesFilterQuery(
        { filter: "collectible", genre: "일상 판타지", weekday: "fri" },
        2,
        24,
      ),
    ).toBe(
      "/api/series?filter=collectible&genre=%EC%9D%BC%EC%83%81+%ED%8C%90%ED%83%80%EC%A7%80&weekday=fri&page=2&pageSize=24",
    );
  });

  it("omits the all filter from discovery links", () => {
    expect(catalogHref({ filter: "all" })).toBe("/#discover");
    expect(catalogHref({ filter: "ongoing", weekday: "mon" })).toBe(
      "/?filter=ongoing&weekday=mon#discover",
    );
  });
});
