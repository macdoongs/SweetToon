import { z } from "zod";

export const OrderIdParamSchema = z.string().cuid();
export const SeasonIdSchema = z.string().cuid();
export const BookSizeSchema = z.enum(
  ["A5", "B5"],
  "판형은 A5와 B5 중에서 선택해 주세요.",
);
export const CoverTypeSchema = z.enum(
  ["softcover", "hardcover"],
  "표지는 소프트커버와 하드커버 중에서 선택해 주세요.",
);
export const OrderStatusSchema = z.enum([
  "pending",
  "processing",
  "shipped",
  "completed",
  "canceled",
]);

export const PrintQuoteRequestSchema = z.object({
  seasonId: SeasonIdSchema,
  volumeNumber: z.number().int().positive(),
  bookSize: BookSizeSchema,
  coverType: CoverTypeSchema,
  quantity: z
    .number("수량은 숫자로 입력해 주세요.")
    .int("수량은 정수로 입력해 주세요.")
    .min(1, "수량은 1권 이상 입력해 주세요.")
    .max(50, "수량은 한 번에 50권까지 주문할 수 있어요."),
});

export const PrintQuoteResponseSchema = z.object({
  provider: z.literal("mock"),
  currency: z.literal("KRW"),
  unitPrice: z.number().int().nonnegative(),
  totalPrice: z.number().int().nonnegative(),
  estimatedBusinessDays: z.number().int().positive(),
  pageCount: z.number().int().positive(),
  volumeNumber: z.number().int().positive(),
  episodeRange: z.object({
    from: z.number().int().positive(),
    to: z.number().int().positive(),
  }),
  series: z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
  }),
  season: z.object({
    id: z.string(),
    number: z.number().int().positive(),
    title: z.string().nullable(),
  }),
});

export const CreateOrderRequestSchema = PrintQuoteRequestSchema.extend({
  requestKey: z.string().uuid(),
  candyWalletToken: z.string().uuid(),
  ordererName: z
    .string("주문자 닉네임을 입력해 주세요.")
    .trim()
    .min(2, "주문자 닉네임은 2자 이상 입력해 주세요.")
    .max(30, "주문자 닉네임은 30자 이하로 입력해 주세요."),
  memo: z
    .string()
    .trim()
    .max(200, "메모는 200자 이하로 적어 주세요.")
    .nullable()
    .optional(),
});

export const OrderTransitionRequestSchema = z.object({
  status: z.enum(["processing", "shipped", "completed"]),
});

export const OrderListQuerySchema = z.object({
  cursor: OrderIdParamSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // active=제작 진행(pending/processing/shipped), done=완료·취소
  status: z.enum(["active", "done"]).optional(),
  // reader=실제 데모 사용자 주문, bot=봇 데모 주문
  source: z.enum(["reader", "bot"]).optional(),
  series: z.string().trim().min(1).max(80).optional(),
});

export const OrderEventSchema = z.object({
  id: z.string(),
  status: OrderStatusSchema,
  message: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const OrderDetailSchema = z.object({
  id: z.string(),
  isDemo: z.boolean(),
  providerOrderId: z.string().nullable(),
  candyBonus: z.number().int().nonnegative(),
  ordererType: z.enum(["reader", "creator"]),
  volumeNumber: z.number().int().positive(),
  quantity: z.number().int().positive(),
  coverType: z.string(),
  bookSize: z.string(),
  pageCount: z.number().int().positive().nullable(),
  currency: z.string().nullable(),
  unitPrice: z.number().int().nonnegative().nullable(),
  totalPrice: z.number().int().nonnegative().nullable(),
  estimatedBusinessDays: z.number().int().positive().nullable(),
  status: OrderStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  series: z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    coverUrl: z.string().nullable(),
  }),
  season: z.object({
    id: z.string(),
    number: z.number().int().positive(),
    title: z.string().nullable(),
  }),
  events: z.array(OrderEventSchema),
});

export const OrderReceiptSchema = OrderDetailSchema.extend({
  entitlementToken: z.string().uuid(),
});

export const OrderSummarySchema = OrderDetailSchema.omit({ events: true });

export const OrderListResponseSchema = z.object({
  items: z.array(OrderSummarySchema),
  nextCursor: OrderIdParamSchema.nullable(),
});

export type PrintQuoteRequest = z.infer<typeof PrintQuoteRequestSchema>;
export type PrintQuoteResponse = z.infer<typeof PrintQuoteResponseSchema>;
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
export type OrderDetail = z.infer<typeof OrderDetailSchema>;
export type OrderReceipt = z.infer<typeof OrderReceiptSchema>;
export type OrderListQuery = z.infer<typeof OrderListQuerySchema>;
export type OrderSummary = z.infer<typeof OrderSummarySchema>;
export type OrderListResponse = z.infer<typeof OrderListResponseSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderTransitionRequest = z.infer<
  typeof OrderTransitionRequestSchema
>;
