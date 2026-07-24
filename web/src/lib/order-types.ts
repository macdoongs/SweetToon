export type BookSize = "A5" | "B5";
export type CoverType = "softcover" | "hardcover";
export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "completed"
  | "canceled";

export type PrintQuoteRequest = {
  seasonId: string;
  bookSize: BookSize;
  coverType: CoverType;
  quantity: number;
};

export type PrintQuoteResponse = {
  provider: "mock";
  currency: "KRW";
  unitPrice: number;
  totalPrice: number;
  estimatedBusinessDays: number;
  pageCount: number;
  series: { id: string; slug: string; title: string };
  season: { id: string; number: number; title: string | null };
};

export type CreateOrderRequest = PrintQuoteRequest & {
  requestKey: string;
  ordererName: string;
  memo?: string | null;
};

export type OrderDetail = {
  id: string;
  providerOrderId: string | null;
  ordererType: "reader" | "creator";
  quantity: number;
  coverType: string;
  bookSize: string;
  pageCount: number | null;
  currency: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  estimatedBusinessDays: number | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  series: {
    id: string;
    slug: string;
    title: string;
    coverUrl: string | null;
  };
  season: { id: string; number: number; title: string | null };
  events: Array<{
    id: string;
    status: OrderStatus;
    message: string | null;
    createdAt: string;
  }>;
};

export type OrderListResponse = { items: OrderDetail[] };
