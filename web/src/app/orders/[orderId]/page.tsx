import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderDetailPage } from "@/components/order-detail-page";
import { getOrder, ServerApiError } from "@/lib/server-api";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ storage?: string | string[] }>;
};

export const metadata: Metadata = {
  title: "주문 상세",
  description: "SweetToon 소장본의 제작 진행 상태를 확인합니다.",
  robots: { index: false, follow: false },
};

export default async function Page({ params, searchParams }: Props) {
  const [{ orderId }, query] = await Promise.all([params, searchParams]);
  let order: Awaited<ReturnType<typeof getOrder>>;
  try {
    order = await getOrder(orderId);
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
  return (
    <OrderDetailPage
      browserStorageUnavailable={query.storage === "unavailable"}
      order={order}
    />
  );
}
