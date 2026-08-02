import type { Metadata } from "next";
import { StudioPackagingPage } from "@/components/studio-packaging-page";

export const metadata: Metadata = {
  title: "책 패키징 신청",
  description: "플랫폼 밖 원고의 책 사양 입력과 신청 이력을 관리합니다.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <StudioPackagingPage />;
}
