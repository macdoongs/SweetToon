import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudioSeriesManagePage } from "@/components/studio-series-manage-page";
import { getSeriesDetail, ServerApiError } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "작품 관리",
  description: "작품 정보·표지·시즌·공개 범위·등록 회차를 관리합니다.",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let detail: Awaited<ReturnType<typeof getSeriesDetail>>;
  try {
    detail = await getSeriesDetail(slug);
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
  return <StudioSeriesManagePage detail={detail} />;
}
