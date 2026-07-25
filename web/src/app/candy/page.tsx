import type { Metadata } from "next";
import { CandyPage } from "@/components/candy-page";

export const metadata: Metadata = {
  title: "캔디 충전",
  description: "SweetToon 데모 캔디를 충전합니다.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CandyPage />;
}
