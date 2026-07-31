import type { Metadata } from "next";
import { StudioDraftsPage } from "@/components/studio-drafts-page";

export const metadata: Metadata = {
  title: "비공개 보관함",
  description: "작품을 가로질러 검수 대기 중인 회차를 관리합니다.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <StudioDraftsPage />;
}
