import type {
  CreateOrderRequest,
  OrderDetail,
} from "../contracts/order";
import type {
  PrintOrderResult,
  PrintProvider,
  PrintQuote,
  PrintSpecification,
} from "../printing/print-provider";
import type {
  CreatePendingOrderInput,
  OrderRepository,
  OrderableSeason,
} from "../repositories/order-repository";
import { OrderService, OrderServiceError } from "./order-service";

const season: OrderableSeason = {
  id: "cmseason00000000000000001",
  number: 1,
  title: "얼룩의 계절",
  status: "completed",
  pageCount: 64,
  volumeNumber: 1,
  episodeRange: { from: 1, to: 5 },
  series: {
    id: "series-1",
    slug: "moonlight-laundry",
    title: "달빛 세탁소",
    coverUrl: null,
  },
};

const input: CreateOrderRequest = {
  requestKey: "f371de0c-01cd-4214-99f7-7cd8e1df82a0",
  candyWalletToken: "e4a40518-b468-4a0a-b51d-309cd07e630c",
  seasonId: season.id,
  volumeNumber: 1,
  bookSize: "A5",
  coverType: "hardcover",
  quantity: 1,
  ordererName: "김소장",
  memo: null,
};

function orderFixture(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: "cmorder000000000000000001",
    providerOrderId: null,
    candyBonus: 0,
    ordererType: "reader",
    volumeNumber: input.volumeNumber,
    quantity: input.quantity,
    coverType: input.coverType,
    bookSize: input.bookSize,
    pageCount: season.pageCount,
    currency: "KRW",
    unitPrice: 9_940,
    totalPrice: 9_940,
    estimatedBusinessDays: 5,
    status: "pending",
    createdAt: "2026-07-24T00:00:00.000Z",
    updatedAt: "2026-07-24T00:00:00.000Z",
    series: season.series,
    season: {
      id: season.id,
      number: season.number,
      title: season.title,
    },
    events: [
      {
        id: "event-1",
        status: "pending",
        message: "소장본 주문이 접수되었어요.",
        createdAt: "2026-07-24T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function makeDependencies() {
  let savedOrder: OrderDetail | null = null;
  const repository: jest.Mocked<OrderRepository> = {
    findOrderableSeason: jest.fn().mockResolvedValue(season),
    findByRequestKey: jest.fn().mockImplementation(async () => savedOrder),
    createPendingOrder: jest
      .fn()
      .mockImplementation(async (_input: CreatePendingOrderInput) => {
        savedOrder = orderFixture();
        return savedOrder;
      }),
    attachProviderOrder: jest
      .fn()
      .mockImplementation(async (_id, providerOrderId) => {
        savedOrder = orderFixture({ providerOrderId, status: "processing" });
        return savedOrder;
      }),
    transitionStatus: jest.fn(),
    markCanceled: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    listOrders: jest.fn().mockResolvedValue({ items: [] }),
  };
  const provider: jest.Mocked<PrintProvider> = {
    name: "mock",
    quote: jest
      .fn()
      .mockImplementation(async (specification: PrintSpecification) => {
        const quote: PrintQuote = {
          provider: "mock",
          currency: "KRW",
          unitPrice: 9_940,
          totalPrice: 9_940 * specification.quantity,
          estimatedBusinessDays: 5,
        };
        return quote;
      }),
    createOrder: jest.fn().mockResolvedValue({
      provider: "mock",
      providerOrderId: "mock-order-1",
      referenceId: "cmorder000000000000000001",
      status: "pending",
    } satisfies PrintOrderResult),
    getOrder: jest.fn().mockResolvedValue(null),
  };

  return { repository, provider, service: new OrderService(repository, provider) };
}

describe("OrderService", () => {
  it("calculates a quote from the completed season page count", async () => {
    const { service, provider } = makeDependencies();

    const quote = await service.quote(input);

    expect(provider.quote).toHaveBeenCalledWith({
      size: "A5",
      binding: "perfect",
      coverType: "hardcover",
      pageCount: 64,
      quantity: 1,
    });
    expect(quote.pageCount).toBe(64);
    expect(quote.series.title).toBe("달빛 세탁소");
  });

  it("rejects a season that is not completed", async () => {
    const { service, repository, provider } = makeDependencies();
    repository.findOrderableSeason.mockResolvedValue({
      ...season,
      status: "ongoing",
    });

    await expect(service.quote(input)).rejects.toMatchObject({
      code: "SEASON_NOT_COMPLETED",
      status: 409,
    } satisfies Partial<OrderServiceError>);
    expect(provider.quote).not.toHaveBeenCalled();
  });

  it("persists the local order before submitting it to the provider", async () => {
    const { service, repository, provider } = makeDependencies();

    const created = await service.create(input);

    expect(repository.createPendingOrder).toHaveBeenCalledTimes(1);
    expect(provider.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceId: "cmorder000000000000000001",
      }),
    );
    expect(repository.attachProviderOrder).toHaveBeenCalledWith(
      "cmorder000000000000000001",
      "mock-order-1",
    );
    expect(created.providerOrderId).toBe("mock-order-1");
  });

  it("returns the existing order for a repeated request key", async () => {
    const { service, repository, provider } = makeDependencies();
    repository.findByRequestKey.mockResolvedValue(orderFixture());

    const existing = await service.create(input);

    expect(existing.id).toBe("cmorder000000000000000001");
    expect(repository.createPendingOrder).not.toHaveBeenCalled();
    expect(provider.createOrder).not.toHaveBeenCalled();
  });

  it("returns the winning order when concurrent requests race", async () => {
    const { service, repository, provider } = makeDependencies();
    repository.findByRequestKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(orderFixture());
    repository.createPendingOrder.mockRejectedValue(
      new Error("unique request key"),
    );

    const existing = await service.create(input);

    expect(existing.id).toBe("cmorder000000000000000001");
    expect(repository.findByRequestKey).toHaveBeenCalledTimes(2);
    expect(provider.createOrder).not.toHaveBeenCalled();
  });

  it("records a cancellation when provider submission fails", async () => {
    const { service, repository, provider } = makeDependencies();
    provider.createOrder.mockRejectedValue(new Error("provider unavailable"));

    await expect(service.create(input)).rejects.toMatchObject({
      code: "PRINT_SUBMISSION_FAILED",
      status: 502,
    } satisfies Partial<OrderServiceError>);
    expect(repository.markCanceled).toHaveBeenCalledWith(
      "cmorder000000000000000001",
      expect.any(String),
    );
  });

  it("moves an order through only the next production status", async () => {
    const { service, repository } = makeDependencies();
    repository.findById.mockResolvedValue(
      orderFixture({ status: "processing" }),
    );
    repository.transitionStatus.mockResolvedValue(
      orderFixture({ status: "shipped" }),
    );

    const updated = await service.transition(
      "cmorder000000000000000001",
      { status: "shipped" },
    );

    expect(updated.status).toBe("shipped");
    expect(repository.transitionStatus).toHaveBeenCalledWith(
      "cmorder000000000000000001",
      "processing",
      "shipped",
      "소장본 제작을 마치고 배송을 시작했어요.",
    );
  });

  it("rejects skipped or terminal production transitions", async () => {
    const { service, repository } = makeDependencies();
    repository.findById.mockResolvedValue(
      orderFixture({ status: "processing" }),
    );

    await expect(
      service.transition("cmorder000000000000000001", {
        status: "completed",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_ORDER_TRANSITION",
      status: 409,
    } satisfies Partial<OrderServiceError>);
    expect(repository.transitionStatus).not.toHaveBeenCalled();
  });
});
