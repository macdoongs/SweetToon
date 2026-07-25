"use client";

const TOKEN_KEY = "sweettoon:candy-wallet-token";
export const CANDY_UPDATED_EVENT = "sweettoon:candy-updated";

export type CandyWallet = {
  balance: number;
  unitPrice: 100;
};

export type CandyUnlockResponse = CandyWallet & {
  episodeId: string;
  spent: boolean;
};

export function getCandyWalletToken(): string {
  const existing = localStorage.getItem(TOKEN_KEY);
  if (existing) return existing;
  const token = crypto.randomUUID();
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

export function notifyCandyUpdated() {
  window.dispatchEvent(new Event(CANDY_UPDATED_EVENT));
}
