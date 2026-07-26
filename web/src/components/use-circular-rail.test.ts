import { describe, expect, it } from "vitest";
import {
  buildCircularRailCopies,
  prioritizeThumbnailItems,
} from "./use-circular-rail";

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

  it("places thumbnail items first without changing order within each group", () => {
    const items = [
      { id: "plain-1", coverUrl: null },
      { id: "cover-1", coverUrl: "/cover-1.webp" },
      { id: "plain-2", coverUrl: null },
      { id: "cover-2", coverUrl: "/cover-2.webp" },
    ];

    expect(
      prioritizeThumbnailItems(items, (item) => Boolean(item.coverUrl)).map(
        (item) => item.id,
      ),
    ).toEqual(["cover-1", "cover-2", "plain-1", "plain-2"]);
    expect(items.map((item) => item.id)).toEqual([
      "plain-1",
      "cover-1",
      "plain-2",
      "cover-2",
    ]);
  });
});
