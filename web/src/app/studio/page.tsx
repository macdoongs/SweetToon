import type { Metadata } from "next";
import { StudioPage } from "@/components/studio-page";
import { getStudioSeriesList } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "작가 스튜디오",
  description: "ZIP 또는 CBZ 원고를 미리 보고 새 웹툰 에피소드로 등록합니다.",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawMode = Array.isArray(query.mode) ? query.mode[0] : query.mode;
  const initialPurpose =
    rawMode === "draft" || rawMode === "packaging" ? rawMode : "publish";
  // 스튜디오 전용 경량 목록으로 모든 작품을 노출하고, 무거운 회차 상세는
  // 선택한 작품에 대해서만 클라이언트에서 조회한다.
  const list = await getStudioSeriesList();
  return <StudioPage initialPurpose={initialPurpose} seriesList={list.items} />;
}
