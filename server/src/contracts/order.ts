import { z } from "zod";

export const OrderIdParamSchema = z.string().cuid();
export const SeasonIdSchema = z.string().cuid();
export const BookSizeSchema = z.enum(["A5", "B5"]);
export const CoverTypeSchema = z.enum(["softcover", "hardcover"]);
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
  quantity: z.number().int().min(1).max(50),
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
  ordererName: z.string().trim().min(2).max(30),
  memo: z.string().trim().max(200).nullable().optional(),
});

export const OrderTransitionRequestSchema = z.object({
  status: z.enum(["processing", "shipped", "completed"]),
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

export const OrderListResponseSchema = z.object({
  items: z.array(OrderDetailSchema),
});

export type PrintQuoteRequest = z.infer<typeof PrintQuoteRequestSchema>;
export type PrintQuoteResponse = z.infer<typeof PrintQuoteResponseSchema>;
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
export type OrderDetail = z.infer<typeof OrderDetailSchema>;
export type OrderListResponse = z.infer<typeof OrderListResponseSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderTransitionRequest = z.infer<
  typeof OrderTransitionRequestSchema
>;
