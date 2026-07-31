import type { Metadata } from "next";
import { OperationsBotPage } from "@/components/operations-bot-page";

export const metadata: Metadata = {
  title: "데모 운영자 · 실시간 봇",
  description: "SweetToon 공용 데모의 실시간 봇을 제어하는 화면입니다.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <OperationsBotPage />;
}
