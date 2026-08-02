import { writeLocalStorage } from "./local-storage";

const STORAGE_KEY = "sweettoon:my-orders";
const MAX_ENTRIES = 20;

export type MyOrderRecord = {
  id: string;
  seriesTitle: string;
  seasonNumber: number;
  volumeNumber: number;
  createdAt: string;
};

export function getMyOrders(): MyOrderRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as MyOrderRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMyOrder(record: MyOrderRecord): boolean {
  const next = [
    record,
    ...getMyOrders().filter((entry) => entry.id !== record.id),
  ].slice(0, MAX_ENTRIES);
  return writeLocalStorage(STORAGE_KEY, JSON.stringify(next));
}
