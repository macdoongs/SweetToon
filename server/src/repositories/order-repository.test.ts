import { episodeRangeFromNumbers } from "./order-repository";

describe("episodeRangeFromNumbers", () => {
  it("uses actual episode numbers when a volume has gaps", () => {
    expect(episodeRangeFromNumbers([1, 3, 5], 1)).toEqual({
      from: 1,
      to: 5,
    });
  });

  it("keeps a positive fallback for an empty volume", () => {
    expect(episodeRangeFromNumbers([], 6)).toEqual({
      from: 6,
      to: 6,
    });
  });
});
