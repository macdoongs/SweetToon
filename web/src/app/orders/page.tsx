import type { Metadata } from "next";
import { MyOrdersPage } from "@/components/my-orders-page";

export const metadata: Metadata = {
  title: "주문 현황",
  description: "이 브라우저에서 만든 SweetToon 소장본 주문을 확인합니다.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <MyOrdersPage />;
}
