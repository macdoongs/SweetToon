import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  StudioEpisodeNewPage,
  type ReplaceTarget,
} from "@/components/studio-episode-new-page";
import { getSeriesDetail, ServerApiError } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "새 회차 올리기",
  description: "ZIP 또는 CBZ 원고를 미리 보고 새 웹툰 에피소드로 등록합니다.",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    replace?: string | string[];
    number?: string | string[];
    title?: string | string[];
  }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const first = (value?: string | string[]) =>
    Array.isArray(value) ? value[0] : value;
  const replaceId = first(query.replace);
  const replaceTarget: ReplaceTarget | null = replaceId
    ? {
        id: replaceId,
        number: Number(first(query.number)) || 0,
        title: first(query.title) ?? "",
      }
    : null;
  let detail: Awaited<ReturnType<typeof getSeriesDetail>>;
  try {
    detail = await getSeriesDetail(slug);
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
  return (
    <StudioEpisodeNewPage detail={detail} replaceTarget={replaceTarget} />
  );
}
