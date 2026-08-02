import { describe, expect, it } from "vitest";
import { rotateBatchForVariety } from "./shorts-variety";

function item(slug: string, authorName: string, genre: string) {
  return { series: { authorName, genre, slug } };
}

function slugs(items: Array<{ series: { slug: string } }>) {
  return items.map((entry) => entry.series.slug);
}

describe("rotateBatchForVariety", () => {
  it("직전 카드와 같은 작가로 시작하면 다른 작가가 앞에 오도록 회전한다", () => {
    const batch = [
      item("a", "달무리", "로맨스"),
      item("b", "별밤", "판타지"),
      item("c", "새벽", "스릴러"),
    ];

    const result = rotateBatchForVariety(batch, [item("z", "달무리", "드라마")]);

    expect(slugs(result)).toEqual(["b", "c", "a"]);
  });

  it("같은 장르가 세 번째로 이어지면 다른 장르가 앞에 오도록 회전한다", () => {
    const batch = [
      item("a", "작가1", "로맨스"),
      item("b", "작가2", "판타지"),
    ];

    const result = rotateBatchForVariety(batch, [
      item("y", "작가8", "로맨스"),
      item("z", "작가9", "로맨스"),
    ]);

    expect(slugs(result)).toEqual(["b", "a"]);
  });

  it("겹치지 않으면 서버 순서를 그대로 둔다", () => {
    const batch = [
      item("a", "작가1", "로맨스"),
      item("b", "작가2", "판타지"),
    ];

    const result = rotateBatchForVariety(batch, [item("z", "작가9", "스릴러")]);

    expect(slugs(result)).toEqual(["a", "b"]);
  });

  it("모든 항목이 겹치면 순서를 바꾸지 않는다", () => {
    const batch = [
      item("a", "달무리", "로맨스"),
      item("b", "달무리", "판타지"),
    ];

    const result = rotateBatchForVariety(batch, [item("z", "달무리", "드라마")]);

    expect(slugs(result)).toEqual(["a", "b"]);
  });

  it("직전 카드가 없으면 회전하지 않는다", () => {
    const batch = [
      item("a", "작가1", "로맨스"),
      item("b", "작가2", "판타지"),
    ];

    expect(slugs(rotateBatchForVariety(batch, []))).toEqual(["a", "b"]);
  });

  it("항목을 잃거나 늘리지 않는다", () => {
    const batch = [
      item("a", "달무리", "로맨스"),
      item("b", "별밤", "판타지"),
      item("c", "새벽", "스릴러"),
    ];

    const result = rotateBatchForVariety(batch, [item("z", "달무리", "로맨스")]);

    expect([...slugs(result)].sort()).toEqual(["a", "b", "c"]);
  });
});
