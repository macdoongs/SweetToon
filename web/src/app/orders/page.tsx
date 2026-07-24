import type { Metadata } from "next";
import { OrderListPage } from "@/components/order-list-page";
import { getOrders } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "데모 주문 현황",
  description: "SweetToon 데모 주문의 제작 상태를 확인합니다.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const { items } = await getOrders();
  return <OrderListPage orders={items} />;
}
