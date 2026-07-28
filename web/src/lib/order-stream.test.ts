import { describe, expect, it } from "vitest";
import type { OrderDetail } from "./order-types";
import { parseOrderStreamEvent } from "./order-stream";

const order = {
  id: "order-1",
  status: "processing",
  updatedAt: "2026-07-28T01:00:00.000Z",
  series: { title: "달빛 세탁소" },
  season: { number: 1 },
  events: [],
} as OrderDetail;

describe("parseOrderStreamEvent", () => {
  it("accepts the minimum trusted order stream shape", () => {
    expect(parseOrderStreamEvent(JSON.stringify(order))).toEqual(order);
  });

  it.each(["{", "null", "{}", '{"id":"order-1"}'])(
    "rejects malformed or incomplete stream data: %s",
    (data) => {
      expect(parseOrderStreamEvent(data)).toBeNull();
    },
  );
});
