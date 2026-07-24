import type { Metadata } from "next";
import { OrderListPage } from "@/components/order-list-page";
import { getOrders } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "내 주문",
  description: "SweetToon 소장본 주문과 제작 상태를 확인합니다.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const { items } = await getOrders();
  return <OrderListPage orders={items} />;
}
