import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StudioHomePage } from "@/components/studio-home-page";
import { getStudioSeriesList } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "작가 스튜디오",
  description: "작품을 고르고 회차 발행·시즌·공개 범위를 관리합니다.",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawMode = Array.isArray(query.mode) ? query.mode[0] : query.mode;
  // 이전 ?mode= 주소는 분리된 하위 라우트로 안내한다.
  if (rawMode === "draft") redirect("/studio/drafts");
  if (rawMode === "packaging") redirect("/studio/packaging");

  const list = await getStudioSeriesList();
  return <StudioHomePage seriesList={list.items} />;
}
