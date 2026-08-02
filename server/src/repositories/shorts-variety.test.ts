import { orderShortsForVariety } from "./shorts-variety";

type Candidate = {
  series: { authorName: string; genre: string; slug: string };
};

function candidate(slug: string, authorName: string, genre: string): Candidate {
  return { series: { authorName, genre, slug } };
}

function authors(items: Candidate[]) {
  return items.map((item) => item.series.authorName);
}

function genres(items: Candidate[]) {
  return items.map((item) => item.series.genre);
}

function hasConsecutiveAuthor(items: Candidate[]) {
  return items.some(
    (item, index) =>
      index > 0 && items[index - 1].series.authorName === item.series.authorName,
  );
}

function longestGenreRun(items: Candidate[]) {
  let longest = 0;
  let current = 0;
  let previous: string | null = null;
  for (const item of items) {
    current = item.series.genre === previous ? current + 1 : 1;
    previous = item.series.genre;
    longest = Math.max(longest, current);
  }
  return longest;
}

describe("orderShortsForVariety", () => {
  it("같은 작가가 연속된 자리를 다른 작가로 채운다", () => {
    const result = orderShortsForVariety(
      [
        candidate("a", "달무리", "로맨스"),
        candidate("b", "달무리", "판타지"),
        candidate("c", "별밤", "스릴러"),
        candidate("d", "별밤", "드라마"),
      ],
      4,
    );

    expect(result).toHaveLength(4);
    expect(hasConsecutiveAuthor(result)).toBe(false);
    expect(authors(result).sort()).toEqual(["달무리", "달무리", "별밤", "별밤"]);
  });

  it("같은 장르가 세 번 이어지지 않도록 순서를 미룬다", () => {
    const result = orderShortsForVariety(
      [
        candidate("a", "작가1", "로맨스"),
        candidate("b", "작가2", "로맨스"),
        candidate("c", "작가3", "로맨스"),
        candidate("d", "작가4", "판타지"),
        candidate("e", "작가5", "판타지"),
        candidate("f", "작가6", "스릴러"),
      ],
      6,
    );

    expect(result).toHaveLength(6);
    expect(longestGenreRun(result)).toBeLessThanOrEqual(2);
  });

  it("규칙을 지킬 수 없어도 요청한 수만큼 채운다", () => {
    const result = orderShortsForVariety(
      [
        candidate("a", "혼자작가", "로맨스"),
        candidate("b", "혼자작가", "로맨스"),
        candidate("c", "혼자작가", "로맨스"),
      ],
      3,
    );

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.series.slug).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("후보보다 큰 limit을 요구해도 후보 수를 넘지 않는다", () => {
    const result = orderShortsForVariety(
      [
        candidate("a", "작가1", "로맨스"),
        candidate("b", "작가2", "판타지"),
      ],
      10,
    );

    expect(result).toHaveLength(2);
  });

  it("limit만큼만 잘라 낸다", () => {
    const result = orderShortsForVariety(
      [
        candidate("a", "작가1", "로맨스"),
        candidate("b", "작가2", "판타지"),
        candidate("c", "작가3", "스릴러"),
      ],
      2,
    );

    expect(result).toHaveLength(2);
    expect(genres(result)).not.toContain(undefined);
  });

  it("원본 배열을 변형하지 않는다", () => {
    const candidates = [
      candidate("a", "달무리", "로맨스"),
      candidate("b", "달무리", "로맨스"),
      candidate("c", "별밤", "판타지"),
    ];
    const snapshot = candidates.map((item) => item.series.slug);

    orderShortsForVariety(candidates, 3);

    expect(candidates.map((item) => item.series.slug)).toEqual(snapshot);
  });
});
