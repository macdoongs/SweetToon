import type { Metadata } from "next";
import { ShortsFeed } from "@/components/shorts-feed";
import { getShortsPreviews, ServerApiError } from "@/lib/server-api";
import type { ShortsPreviewItem } from "@/lib/shorts-types";

export const metadata: Metadata = {
  title: "웹툰 쇼츠",
  description:
    "랜덤 작품의 첫 무료 회차를 짧게 미리 보고 마음에 들면 바로 읽어보세요.",
  alternates: { canonical: "/shorts" },
};

export const dynamic = "force-dynamic";

export default async function ShortsPage() {
  let initialError: string | null = null;
  let initialItems: ShortsPreviewItem[] = [];
  try {
    const previews = await getShortsPreviews();
    initialItems = previews.items;
  } catch (error) {
    initialError =
      error instanceof ServerApiError
        ? error.message
        : "쇼츠 미리보기를 불러오지 못했습니다.";
  }
  return <ShortsFeed initialError={initialError} initialItems={initialItems} />;
}
