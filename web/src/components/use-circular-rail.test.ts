import { describe, expect, it } from "vitest";
import { buildCircularRailCopies } from "./use-circular-rail";

describe("buildCircularRailCopies", () => {
  it("keeps a single item singular because it has no scroll boundary", () => {
    expect(buildCircularRailCopies(["only"])).toEqual([
      {
        copyIndex: 0,
        duplicate: false,
        eager: false,
        item: "only",
      },
    ]);
  });

  it("builds five copies and exposes only the center copy", () => {
    const copies = buildCircularRailCopies(["first", "second"]);

    expect(copies).toHaveLength(10);
    expect(copies.filter((copy) => !copy.duplicate)).toEqual([
      {
        copyIndex: 2,
        duplicate: false,
        eager: false,
        item: "first",
      },
      {
        copyIndex: 2,
        duplicate: false,
        eager: false,
        item: "second",
      },
    ]);
    expect(copies.filter((copy) => copy.eager)).toHaveLength(4);
  });
});
