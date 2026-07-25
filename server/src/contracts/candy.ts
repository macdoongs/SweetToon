import { z } from "zod";

export const CandyWalletTokenSchema = z.string().uuid();

export const CandyWalletSchema = z.object({
  balance: z.number().int().nonnegative(),
  unitPrice: z.literal(100),
});

export const CandyUnlockRequestSchema = z.object({
  walletToken: CandyWalletTokenSchema,
  requestKey: z.string().uuid(),
});

export const CandyUnlockResponseSchema = CandyWalletSchema.extend({
  episodeId: z.string(),
  spent: z.boolean(),
});

export const CandyChargeAmountSchema = z.union([
  z.literal(10),
  z.literal(30),
  z.literal(50),
]);

export const CandyChargeRequestSchema = z.object({
  requestKey: z.string().uuid(),
  candyAmount: CandyChargeAmountSchema,
});

export const CandyChargeResponseSchema = CandyWalletSchema.extend({
  chargedCandy: CandyChargeAmountSchema,
  price: z.number().int().positive(),
  currency: z.literal("KRW"),
  mock: z.literal(true),
  charged: z.boolean(),
});

export type CandyWallet = z.infer<typeof CandyWalletSchema>;
export type CandyUnlockRequest = z.infer<typeof CandyUnlockRequestSchema>;
export type CandyUnlockResponse = z.infer<typeof CandyUnlockResponseSchema>;
export type CandyChargeRequest = z.infer<typeof CandyChargeRequestSchema>;
export type CandyChargeResponse = z.infer<typeof CandyChargeResponseSchema>;
