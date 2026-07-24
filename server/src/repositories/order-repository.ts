import { PrismaClient, type Prisma } from "@prisma/client";
import type {
  CreateOrderRequest,
  OrderDetail,
  OrderListResponse,
} from "../contracts/order";
import type { PrintQuote } from "../printing/print-provider";

export type OrderableSeason = {
  id: string;
  number: number;
  title: string | null;
  status: string;
  pageCount: number;
  series: {
    id: string;
    slug: string;
    title: string;
    coverUrl: string | null;
  };
};

export type CreatePendingOrderInput = CreateOrderRequest & {
  season: OrderableSeason;
  quote: PrintQuote;
};

export interface OrderRepository {
  findOrderableSeason(id: string): Promise<OrderableSeason | null>;
  findByRequestKey(requestKey: string): Promise<OrderDetail | null>;
  createPendingOrder(input: CreatePendingOrderInput): Promise<OrderDetail>;
  attachProviderOrder(
    orderId: string,
    providerOrderId: string,
  ): Promise<OrderDetail>;
  markCanceled(orderId: string, message: string): Promise<void>;
  findById(id: string): Promise<OrderDetail | null>;
  listOrders(): Promise<OrderListResponse>;
}

const orderInclude = {
  series: true,
  season: true,
  events: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

function toOrderDetail(order: OrderWithRelations): OrderDetail {
  return {
    id: order.id,
    providerOrderId: order.providerOrderId,
    ordererType: order.ordererType === "creator" ? "creator" : "reader",
    quantity: order.quantity,
    coverType: order.coverType,
    bookSize: order.bookSize,
    pageCount: order.pageCount,
    currency: order.currency,
    unitPrice: order.unitPrice,
    totalPrice: order.totalPrice,
    estimatedBusinessDays: order.estimatedBusinessDays,
    status:
      order.status === "processing" ||
      order.status === "shipped" ||
      order.status === "completed" ||
      order.status === "canceled"
        ? order.status
        : "pending",
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    series: {
      id: order.series.id,
      slug: order.series.slug,
      title: order.series.title,
      coverUrl: order.series.coverUrl,
    },
    season: {
      id: order.season.id,
      number: order.season.number,
      title: order.season.title,
    },
    events: order.events.map((event) => ({
      id: event.id,
      status:
        event.status === "processing" ||
        event.status === "shipped" ||
        event.status === "completed" ||
        event.status === "canceled"
          ? event.status
          : "pending",
      message: event.message,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findOrderableSeason(id: string): Promise<OrderableSeason | null> {
    const season = await this.prisma.season.findUnique({
      where: { id },
      include: {
        series: true,
        episodes: {
          select: {
            _count: { select: { pages: true } },
          },
        },
      },
    });

    if (!season) {
      return null;
    }

    return {
      id: season.id,
      number: season.number,
      title: season.title,
      status: season.status,
      pageCount: season.episodes.reduce(
        (total, episode) => total + episode._count.pages,
        0,
      ),
      series: {
        id: season.series.id,
        slug: season.series.slug,
        title: season.series.title,
        coverUrl: season.series.coverUrl,
      },
    };
  }

  async findByRequestKey(requestKey: string): Promise<OrderDetail | null> {
    const order = await this.prisma.order.findUnique({
      where: { requestKey },
      include: orderInclude,
    });
    return order ? toOrderDetail(order) : null;
  }

  async createPendingOrder(
    input: CreatePendingOrderInput,
  ): Promise<OrderDetail> {
    const order = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.order.create({
        data: {
          requestKey: input.requestKey,
          seriesId: input.season.series.id,
          seasonId: input.season.id,
          ordererName: input.ordererName,
          ordererType: "reader",
          quantity: input.quantity,
          coverType: input.coverType,
          bookSize: input.bookSize,
          pageCount: input.season.pageCount,
          currency: input.quote.currency,
          unitPrice: input.quote.unitPrice,
          totalPrice: input.quote.totalPrice,
          estimatedBusinessDays: input.quote.estimatedBusinessDays,
          memo: input.memo || null,
          status: "pending",
        },
      });
      await transaction.orderEvent.create({
        data: {
          orderId: created.id,
          status: "pending",
          message: "소장본 주문이 접수되었어요.",
        },
      });
      return transaction.order.findUniqueOrThrow({
        where: { id: created.id },
        include: orderInclude,
      });
    });

    return toOrderDetail(order);
  }

  async attachProviderOrder(
    orderId: string,
    providerOrderId: string,
  ): Promise<OrderDetail> {
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { providerOrderId },
      include: orderInclude,
    });
    return toOrderDetail(order);
  }

  async markCanceled(orderId: string, message: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: "canceled" },
      }),
      this.prisma.orderEvent.create({
        data: { orderId, status: "canceled", message },
      }),
    ]);
  }

  async findById(id: string): Promise<OrderDetail | null> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    return order ? toOrderDetail(order) : null;
  }

  async listOrders(): Promise<OrderListResponse> {
    const orders = await this.prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    });
    return {
      items: orders.map(toOrderDetail),
    };
  }
}
