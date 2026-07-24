export type BookBinding = "perfect";
export type BookSize = "A5" | "B5";

export interface PrintSpecification {
  size: BookSize;
  binding: BookBinding;
  pageCount: number;
  quantity: number;
}

export interface PrintQuote {
  provider: "mock";
  currency: "KRW";
  unitPrice: number;
  totalPrice: number;
  estimatedBusinessDays: number;
}

export interface CreatePrintOrderInput {
  referenceId: string;
  recipientName: string;
  specification: PrintSpecification;
}

export type PrintOrderStatus =
  | "pending"
  | "processing"
  | "completed"
  | "cancelled";

export interface PrintOrderResult {
  provider: "mock";
  providerOrderId: string;
  referenceId: string;
  status: PrintOrderStatus;
}

export interface PrintProvider {
  readonly name: "mock";
  quote(specification: PrintSpecification): Promise<PrintQuote>;
  createOrder(input: CreatePrintOrderInput): Promise<PrintOrderResult>;
  getOrder(providerOrderId: string): Promise<PrintOrderResult | null>;
}
