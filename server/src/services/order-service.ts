import type {
  CreateOrderRequest,
  OrderDetail,
  OrderListResponse,
  OrderStatus,
  OrderTransitionRequest,
  PrintQuoteRequest,
  PrintQuoteResponse,
} from "../contracts/order";
import type { PrintProvider } from "../printing/print-provider";
import type {
  OrderRepository,
  OrderableSeason,
} from "../repositories/order-repository";

export class OrderServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "OrderServiceError";
  }
}

export interface OrderUseCases {
  quote(input: PrintQuoteRequest): Promise<PrintQuoteResponse>;
  create(input: CreateOrderRequest): Promise<OrderDetail>;
  get(id: string): Promise<OrderDetail>;
  list(): Promise<OrderListResponse>;
  transition(id: string, input: OrderTransitionRequest): Promise<OrderDetail>;
}

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "processing",
  processing: "shipped",
  shipped: "completed",
};

const transitionMessage: Record<"processing" | "shipped" | "completed", string> = {
  processing: "소장본 제작을 시작했어요.",
  shipped: "소장본 제작을 마치고 배송을 시작했어요.",
  completed: "소장본 배송이 완료되었어요.",
};

export class OrderService implements OrderUseCases {
  constructor(
    private readonly repository: OrderRepository,
    private readonly printProvider: PrintProvider,
  ) {}

  private async requireOrderableSeason(
    seasonId: string,
    volumeNumber: number,
  ): Promise<OrderableSeason> {
    const season = await this.repository.findOrderableSeason(
      seasonId,
      volumeNumber,
    );
    if (!season) {
      throw new OrderServiceError(
        "SEASON_NOT_FOUND",
        "주문할 시즌을 찾을 수 없습니다.",
        404,
      );
    }
    if (season.status !== "completed") {
      throw new OrderServiceError(
        "SEASON_NOT_COMPLETED",
        "완결된 시즌만 소장본으로 주문할 수 있습니다.",
        409,
      );
    }
    if (season.pageCount === 0) {
      throw new OrderServiceError(
        "SEASON_HAS_NO_PAGES",
        "인쇄할 페이지가 없어 아직 주문할 수 없습니다.",
        409,
      );
    }
    return season;
  }

  private async buildQuote(
    input: PrintQuoteRequest,
    season: OrderableSeason,
  ): Promise<PrintQuoteResponse> {
    const quote = await this.printProvider.quote({
      size: input.bookSize,
      binding: "perfect",
      coverType: input.coverType,
      pageCount: season.pageCount,
      quantity: input.quantity,
    });
    return {
      ...quote,
      pageCount: season.pageCount,
      volumeNumber: season.volumeNumber,
      episodeRange: season.episodeRange,
      series: {
        id: season.series.id,
        slug: season.series.slug,
        title: season.series.title,
      },
      season: {
        id: season.id,
        number: season.number,
        title: season.title,
      },
    };
  }

  async quote(input: PrintQuoteRequest): Promise<PrintQuoteResponse> {
    const season = await this.requireOrderableSeason(
      input.seasonId,
      input.volumeNumber,
    );
    return this.buildQuote(input, season);
  }

  async create(input: CreateOrderRequest): Promise<OrderDetail> {
    const existing = await this.repository.findByRequestKey(input.requestKey);
    if (existing) {
      return existing;
    }

    const season = await this.requireOrderableSeason(
      input.seasonId,
      input.volumeNumber,
    );
    const quote = await this.buildQuote(input, season);
    let order: OrderDetail;
    try {
      order = await this.repository.createPendingOrder({
        ...input,
        season,
        quote,
      });
    } catch (error) {
      // Concurrent requests can pass the first lookup together. The database
      // unique constraint chooses the winner and the loser returns its order.
      const racedOrder = await this.repository.findByRequestKey(
        input.requestKey,
      );
      if (racedOrder) {
        return racedOrder;
      }
      throw error;
    }

    try {
      const providerOrder = await this.printProvider.createOrder({
        referenceId: order.id,
        recipientName: input.ordererName,
        specification: {
          size: input.bookSize,
          binding: "perfect",
          coverType: input.coverType,
          pageCount: season.pageCount,
          quantity: input.quantity,
        },
      });
      return this.repository.attachProviderOrder(
        order.id,
        providerOrder.providerOrderId,
      );
    } catch {
      await this.repository.markCanceled(
        order.id,
        "인쇄 접수 중 문제가 생겨 주문이 자동 취소되었어요.",
      );
      throw new OrderServiceError(
        "PRINT_SUBMISSION_FAILED",
        "인쇄 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        502,
      );
    }
  }

  async get(id: string): Promise<OrderDetail> {
    const order = await this.repository.findById(id);
    if (!order) {
      throw new OrderServiceError(
        "ORDER_NOT_FOUND",
        "요청한 주문을 찾을 수 없습니다.",
        404,
      );
    }
    return order;
  }

  list(): Promise<OrderListResponse> {
    return this.repository.listOrders();
  }

  async transition(
    id: string,
    input: OrderTransitionRequest,
  ): Promise<OrderDetail> {
    const order = await this.repository.findById(id);
    if (!order) {
      throw new OrderServiceError(
        "ORDER_NOT_FOUND",
        "요청한 주문을 찾을 수 없습니다.",
        404,
      );
    }
    if (nextStatus[order.status] !== input.status) {
      throw new OrderServiceError(
        "INVALID_ORDER_TRANSITION",
        "현재 제작 단계에서 선택할 수 없는 상태입니다.",
        409,
      );
    }

    const updated = await this.repository.transitionStatus(
      id,
      order.status,
      input.status,
      transitionMessage[input.status],
    );
    if (!updated) {
      throw new OrderServiceError(
        "ORDER_STATUS_CHANGED",
        "다른 작업에서 상태가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
        409,
      );
    }
    return updated;
  }
}
