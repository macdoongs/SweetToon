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

export type CandyWallet = z.infer<typeof CandyWalletSchema>;
export type CandyUnlockRequest = z.infer<typeof CandyUnlockRequestSchema>;
export type CandyUnlockResponse = z.infer<typeof CandyUnlockResponseSchema>;
