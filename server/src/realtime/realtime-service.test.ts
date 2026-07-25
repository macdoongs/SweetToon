import type { OrderDetail } from "../contracts/order";
import {
  InMemoryRealtimeService,
  PRESENCE_TTL_SECONDS,
} from "./realtime-service";

const order = {
  id: "order-1",
  updatedAt: "2026-07-25T00:00:00.000Z",
} as OrderDetail;

describe("InMemoryRealtimeService", () => {
  it("fans an order update out to active subscribers", async () => {
    const realtime = new InMemoryRealtimeService();
    const listener = jest.fn();
    const unsubscribe = await realtime.subscribeOrder(order.id, listener);

    await realtime.publishOrder(order);
    await unsubscribe();
    await realtime.publishOrder({
      ...order,
      updatedAt: "2026-07-25T00:01:00.000Z",
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(order);
  });

  it("counts unique active reader sessions and expires stale presence", async () => {
    let now = 1_000_000;
    const realtime = new InMemoryRealtimeService(() => now);

    expect(await realtime.heartbeatSeries("moonlight-laundry", "reader-a")).toBe(
      1,
    );
    expect(await realtime.heartbeatSeries("moonlight-laundry", "reader-a")).toBe(
      1,
    );
    expect(await realtime.heartbeatSeries("moonlight-laundry", "reader-b")).toBe(
      2,
    );
    expect(await realtime.heartbeatSeries("night-store", "reader-a")).toBe(1);
    expect(await realtime.getViewerCounts(["moonlight-laundry"])).toEqual({
      "moonlight-laundry": 1,
    });

    now += PRESENCE_TTL_SECONDS * 1_000 + 1;

    expect(
      await realtime.getViewerCounts(["moonlight-laundry", "night-store"]),
    ).toEqual({
      "moonlight-laundry": 0,
      "night-store": 0,
    });
  });
});
