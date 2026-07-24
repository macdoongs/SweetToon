import type {
  CreateOrderRequest,
  OrderDetail,
  OrderListResponse,
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
}

export class OrderService implements OrderUseCases {
  constructor(
    private readonly repository: OrderRepository,
    private readonly printProvider: PrintProvider,
  ) {}

  private async requireOrderableSeason(
    seasonId: string,
  ): Promise<OrderableSeason> {
    const season = await this.repository.findOrderableSeason(seasonId);
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
    const season = await this.requireOrderableSeason(input.seasonId);
    return this.buildQuote(input, season);
  }

  async create(input: CreateOrderRequest): Promise<OrderDetail> {
    const existing = await this.repository.findByRequestKey(input.requestKey);
    if (existing) {
      return existing;
    }

    const season = await this.requireOrderableSeason(input.seasonId);
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
}
