import type { OrderDetail, OrderStatus } from "./order-types";

const orderStatuses = new Set<OrderStatus>([
  "pending",
  "processing",
  "shipped",
  "completed",
  "canceled",
]);

export function parseOrderStreamEvent(data: string): OrderDetail | null {
  try {
    const value: unknown = JSON.parse(data);
    if (
      !isRecord(value) ||
      typeof value.id !== "string" ||
      typeof value.updatedAt !== "string" ||
      Number.isNaN(Date.parse(value.updatedAt)) ||
      !orderStatuses.has(value.status as OrderStatus) ||
      !isRecord(value.series) ||
      typeof value.series.title !== "string" ||
      !isRecord(value.season) ||
      typeof value.season.number !== "number" ||
      !Array.isArray(value.events)
    ) {
      return null;
    }
    return value as OrderDetail;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
