import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import http from "node:http";
import request from "supertest";
import { createApp } from "../app";
import type { OrderDetail } from "../contracts/order";
import type { ReaderRepository } from "../repositories/reader-repository";
import {
  OrderServiceError,
  type OrderUseCases,
} from "../services/order-service";
import type { RealtimeService } from "../realtime/realtime-service";

const order: OrderDetail = {
  id: "cmorder000000000000000001",
  isDemo: false,
  providerOrderId: "mock-order-1",
  candyBonus: 5,
  ordererType: "reader",
  volumeNumber: 1,
  quantity: 1,
  coverType: "hardcover",
  bookSize: "A5",
  pageCount: 64,
  currency: "KRW",
  unitPrice: 9_940,
  totalPrice: 9_940,
  estimatedBusinessDays: 5,
  status: "pending",
  createdAt: "2026-07-24T00:00:00.000Z",
  updatedAt: "2026-07-24T00:00:00.000Z",
  series: {
    id: "series-1",
    slug: "moonlight-laundry",
    title: "달빛 세탁소",
    coverUrl: null,
  },
  season: {
    id: "cmseason00000000000000001",
    number: 1,
    title: "얼룩의 계절",
  },
  events: [],
};
const receipt = {
  ...order,
  entitlementToken: "37c4af96-e1ff-48f2-a0b9-909826823f05",
};

function makeReaderRepository(): ReaderRepository {
  return {
    listSeries: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      nextPage: null,
      total: 0,
      facets: { genres: [], weekdays: [] },
    }),
    listRealtimeSeriesKeys: jest.fn().mockResolvedValue([]),
    listRealtimeSeries: jest.fn().mockResolvedValue([]),
    seriesExists: jest.fn().mockResolvedValue(false),
    findSeriesBySlug: jest.fn().mockResolvedValue(null),
    findEpisodeById: jest.fn().mockResolvedValue(null),
  };
}

function makeService(): jest.Mocked<OrderUseCases> {
  return {
    quote: jest.fn().mockResolvedValue({
      provider: "mock",
      currency: "KRW",
      unitPrice: 9_940,
      totalPrice: 9_940,
      estimatedBusinessDays: 5,
      pageCount: 64,
      volumeNumber: 1,
      episodeRange: { from: 1, to: 5 },
      series: {
        id: "series-1",
        slug: "moonlight-laundry",
        title: "달빛 세탁소",
      },
      season: {
        id: "cmseason00000000000000001",
        number: 1,
        title: "얼룩의 계절",
      },
    }),
    create: jest.fn().mockResolvedValue(receipt),
    get: jest.fn().mockResolvedValue(order),
    list: jest.fn().mockResolvedValue({
      items: [order],
      nextCursor: null,
    }),
    transition: jest.fn().mockResolvedValue({
      ...order,
      status: "shipped",
    }),
  };
}

function makeRealtime(): jest.Mocked<RealtimeService> {
  return {
    publishOrder: jest.fn().mockResolvedValue(undefined),
    subscribeOrder: jest.fn().mockResolvedValue(async () => undefined),
    heartbeatSeries: jest.fn().mockResolvedValue(0),
    getViewerCounts: jest.fn().mockResolvedValue({}),
    removePresence: jest.fn().mockResolvedValue(undefined),
    claimLease: jest.fn().mockResolvedValue(true),
    releaseLease: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

function makeApp(service = makeService(), realtime = makeRealtime()) {
  return createApp({
    readerRepository: makeReaderRepository(),
    orderService: service,
    realtime,
    uploadDir: path.join(os.tmpdir(), "sweettoon-order-tests"),
  });
}

describe("order routes", () => {
  it("returns a quote for a valid print specification", async () => {
    const response = await request(makeApp())
      .post("/api/print-quotes")
      .send({
        seasonId: "cmseason00000000000000001",
        volumeNumber: 1,
        bookSize: "A5",
        coverType: "hardcover",
        quantity: 1,
      })
      .expect(200);

    expect(response.body.totalPrice).toBe(9_940);
    expect(response.body.pageCount).toBe(64);
  });

  it("rejects an invalid print specification with a stable error code", async () => {
    const response = await request(makeApp())
      .post("/api/print-quotes")
      .send({ seasonId: "bad", quantity: 0 })
      .expect(400);

    expect(response.body.code).toBe("INVALID_PRINT_SPECIFICATION");
  });

  it("creates and lists persistent orders through the use case boundary", async () => {
    const service = makeService();
    const app = makeApp(service);
    const created = await request(app)
      .post("/api/orders")
      .send({
        requestKey: "f371de0c-01cd-4214-99f7-7cd8e1df82a0",
        candyWalletToken: "e4a40518-b468-4a0a-b51d-309cd07e630c",
        seasonId: "cmseason00000000000000001",
        volumeNumber: 1,
        bookSize: "A5",
        coverType: "hardcover",
        quantity: 1,
        ordererName: "김소장",
        memo: null,
      })
      .expect(201);
    const listed = await request(app).get("/api/orders").expect(200);

    expect(created.body.id).toBe(order.id);
    expect(created.body.entitlementToken).toBe(receipt.entitlementToken);
    expect(listed.body.items[0].id).toBe(order.id);
    expect(created.body).not.toHaveProperty("ordererName");
    expect(created.body).not.toHaveProperty("memo");
    expect(listed.body.items[0]).not.toHaveProperty("ordererName");
    expect(listed.body.items[0]).not.toHaveProperty("memo");
    expect(listed.body.items[0]).not.toHaveProperty("entitlementToken");
    expect(listed.body.items[0]).not.toHaveProperty("events");
    expect(service.list).toHaveBeenCalledWith({ limit: 20 });
  });

  it("passes a bounded cursor page to the order use case", async () => {
    const service = makeService();
    await request(makeApp(service))
      .get(`/api/orders?cursor=${order.id}&limit=1`)
      .expect(200);

    expect(service.list).toHaveBeenCalledWith({
      cursor: order.id,
      limit: 1,
    });
  });

  it("rejects an invalid order-list cursor", async () => {
    const response = await request(makeApp())
      .get("/api/orders?cursor=not-a-cuid")
      .expect(400);

    expect(response.body.code).toBe("INVALID_ORDER_LIST_QUERY");
  });

  it("converts use case errors into user-facing API errors", async () => {
    const service = makeService();
    service.get.mockRejectedValue(
      new OrderServiceError(
        "ORDER_NOT_FOUND",
        "요청한 주문을 찾을 수 없습니다.",
        404,
      ),
    );

    const response = await request(makeApp(service))
      .get("/api/orders/cmorder000000000000000001")
      .expect(404);

    expect(response.body).toEqual({
      code: "ORDER_NOT_FOUND",
      message: "요청한 주문을 찾을 수 없습니다.",
    });
  });

  it("validates and applies an operator status transition", async () => {
    const service = makeService();
    const realtime = makeRealtime();
    const response = await request(makeApp(service, realtime))
      .patch("/api/orders/cmorder000000000000000001/status")
      .send({ status: "shipped" })
      .expect(200);

    expect(service.transition).toHaveBeenCalledWith(
      "cmorder000000000000000001",
      { status: "shipped" },
    );
    expect(response.body.status).toBe("shipped");
    expect(realtime.publishOrder).toHaveBeenCalledWith(
      expect.objectContaining({ id: order.id, status: "shipped" }),
    );
  });

  it("rejects an unsupported operator status", async () => {
    const response = await request(makeApp())
      .patch("/api/orders/cmorder000000000000000001/status")
      .send({ status: "pending" })
      .expect(400);

    expect(response.body.code).toBe("INVALID_ORDER_STATUS");
  });

  it("releases a delayed realtime subscription after the client disconnects", async () => {
    const realtime = makeRealtime();
    let resolveSubscription:
      | ((unsubscribe: () => Promise<void>) => void)
      | undefined;
    const subscriptionStarted = new Promise<void>((resolve) => {
      realtime.subscribeOrder.mockImplementation(
        () =>
          new Promise((resolveSubscribe) => {
            resolveSubscription = resolveSubscribe;
            resolve();
          }),
      );
    });
    const unsubscribe = jest.fn().mockResolvedValue(undefined);
    const server = makeApp(undefined, realtime).listen(0);

    try {
      const { port } = server.address() as AddressInfo;
      const client = http.get(
        `http://127.0.0.1:${port}/api/orders/${order.id}/events`,
      );
      client.on("error", () => undefined);

      await subscriptionStarted;
      client.destroy();
      await new Promise<void>((resolve) => client.once("close", resolve));
      resolveSubscription?.(unsubscribe);

      for (let attempt = 0; attempt < 20 && !unsubscribe.mock.calls.length; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
