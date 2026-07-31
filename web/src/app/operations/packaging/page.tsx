import type { Metadata } from "next";
import { OperationsPackagingPage } from "@/components/operations-packaging-page";

export const metadata: Metadata = {
  title: "데모 운영자 · 패키징 신청",
  description: "책 패키징 신청의 검토 상태를 변경하는 데모 화면입니다.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <OperationsPackagingPage />;
}
