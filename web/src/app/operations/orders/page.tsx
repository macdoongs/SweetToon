import type { Metadata } from "next";
import { OperationsOrderPage } from "@/components/operations-order-page";
import { getOrders } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "데모 운영자 · 주문 관리",
  description: "SweetToon 소장본 주문의 제작 상태를 변경하는 데모 화면입니다.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const initialOrders = await getOrders();
  return <OperationsOrderPage initialResponse={initialOrders} />;
}
