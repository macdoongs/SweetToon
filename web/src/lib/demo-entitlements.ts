const STORAGE_KEY = "sweettoon:demo-entitlements";

type Entitlements = Record<string, string>;

function entitlementKey(seasonId: string, volumeNumber: number) {
  return `${seasonId}:${volumeNumber}`;
}

function readEntitlements(): Entitlements {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Entitlements;
  } catch {
    return {};
  }
}

export function saveDemoEntitlement(
  seasonId: string,
  volumeNumber: number,
  token: string,
): boolean {
  const current = readEntitlements();
  current[entitlementKey(seasonId, volumeNumber)] = token;
  return writeLocalStorage(STORAGE_KEY, JSON.stringify(current));
}

export function getDemoEntitlement(
  seasonId: string,
  volumeNumber: number,
): string | null {
  return readEntitlements()[entitlementKey(seasonId, volumeNumber)] ?? null;
}

export function hasDemoEntitlement(
  seasonId: string,
  volumeNumber: number,
): boolean {
  return Boolean(getDemoEntitlement(seasonId, volumeNumber));
}
import { writeLocalStorage } from "./local-storage";
