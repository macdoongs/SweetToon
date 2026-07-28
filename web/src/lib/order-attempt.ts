export type OrderAttempt = {
  fingerprint: string;
  requestKey: string;
};

export function orderAttemptStorageKey(
  seasonId: string,
  volumeNumber: number,
): string {
  return `sweettoon:order-attempt:${seasonId}:${volumeNumber}`;
}

export function getOrCreateOrderAttempt(
  storageKey: string,
  payload: unknown,
  fallback: OrderAttempt | null,
): OrderAttempt {
  const fingerprint = JSON.stringify(payload);
  const stored = readOrderAttempt(storageKey);
  const current = stored ?? fallback;
  const attempt =
    current?.fingerprint === fingerprint
      ? current
      : { fingerprint, requestKey: crypto.randomUUID() };
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(attempt));
  } catch {
    // useRef fallback still preserves the key until this page is discarded.
  }
  return attempt;
}

export function clearOrderAttempt(storageKey: string): void {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // A blocked browser store must not change the server-side order result.
  }
}

function readOrderAttempt(storageKey: string): OrderAttempt | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OrderAttempt>;
    return typeof parsed.fingerprint === "string" &&
      typeof parsed.requestKey === "string"
      ? {
          fingerprint: parsed.fingerprint,
          requestKey: parsed.requestKey,
        }
      : null;
  } catch {
    return null;
  }
}
