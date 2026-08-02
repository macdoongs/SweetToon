import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderDetailPage } from "@/components/order-detail-page";
import { getOrder, ServerApiError } from "@/lib/server-api";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ storage?: string | string[] }>;
};

const statusTitle: Record<string, string> = {
  pending: "주문 접수",
  processing: "제작 중",
  shipped: "배송 중",
  completed: "배송 완료",
  canceled: "주문 취소",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderId: string }>;
}): Promise<Metadata> {
  const { orderId } = await params;
  try {
    const order = await getOrder(orderId);
    return {
      title: `${order.series.title} · ${
        statusTitle[order.status] ?? "주문 상세"
      }`,
      description: `${order.series.title} 시즌 ${order.season.number} ${order.volumeNumber}권 소장본의 제작 진행 상태입니다.`,
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: "주문 상세",
      description: "SweetToon 소장본의 제작 진행 상태를 확인합니다.",
      robots: { index: false, follow: false },
    };
  }
}

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
