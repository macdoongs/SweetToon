"use client";

const TOKEN_KEY = "sweettoon:candy-wallet-token";
export const CANDY_UPDATED_EVENT = "sweettoon:candy-updated";
let volatileToken: string | null = null;

export type CandyWallet = {
  balance: number;
  unitPrice: 100;
};

export type CandyUnlockResponse = CandyWallet & {
  episodeId: string;
  spent: boolean;
};

export type CandyChargeAmount = 10 | 30 | 50;

export type CandyChargeResponse = CandyWallet & {
  chargedCandy: CandyChargeAmount;
  price: number;
  currency: "KRW";
  mock: true;
  charged: boolean;
};

export function getCandyWalletToken(): string {
  try {
    const existing = localStorage.getItem(TOKEN_KEY);
    if (existing) return existing;
    const token = volatileToken ?? crypto.randomUUID();
    localStorage.setItem(TOKEN_KEY, token);
    volatileToken = token;
    return token;
  } catch {
    volatileToken ??= crypto.randomUUID();
    return volatileToken;
  }
}

export function notifyCandyUpdated() {
  window.dispatchEvent(new Event(CANDY_UPDATED_EVENT));
}
