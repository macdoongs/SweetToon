import { randomUUID } from "node:crypto";
import {
  type CreatePrintOrderInput,
  type PrintOrderResult,
  type PrintProvider,
  type PrintQuote,
  type PrintSpecification,
} from "./print-provider";

export class MockPrintProvider implements PrintProvider {
  readonly name = "mock" as const;
  private readonly orders = new Map<string, PrintOrderResult>();

  async quote(specification: PrintSpecification): Promise<PrintQuote> {
    const basePrice = specification.size === "B5" ? 4_800 : 4_200;
    const pagePrice = specification.pageCount * 35;
    const unitPrice = basePrice + pagePrice;

    return {
      provider: "mock",
      currency: "KRW",
      unitPrice,
      totalPrice: unitPrice * specification.quantity,
      estimatedBusinessDays: 5,
    };
  }

  async createOrder(
    input: CreatePrintOrderInput,
  ): Promise<PrintOrderResult> {
    const order: PrintOrderResult = {
      provider: "mock",
      providerOrderId: `mock_${randomUUID()}`,
      referenceId: input.referenceId,
      status: "pending",
    };

    this.orders.set(order.providerOrderId, order);
    return order;
  }

  async getOrder(providerOrderId: string): Promise<PrintOrderResult | null> {
    return this.orders.get(providerOrderId) ?? null;
  }
}

export function createPrintProvider(
  providerName = process.env.PRINT_PROVIDER ?? "mock",
): PrintProvider {
  if (providerName !== "mock") {
    throw new Error(
      `지원하지 않는 PRINT_PROVIDER입니다: ${providerName}. 과제 환경은 mock만 허용합니다.`,
    );
  }

  return new MockPrintProvider();
}
