import type { Metadata } from "next";
import { StudioPage } from "@/components/studio-page";
import { getSeriesDetail, getSeriesList } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "작가 스튜디오",
  description: "ZIP 또는 CBZ 원고를 미리 보고 새 웹툰 에피소드로 등록합니다.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const list = await getSeriesList();
  const series = await Promise.all(
    list.items.map((item) => getSeriesDetail(item.slug)),
  );
  return <StudioPage series={series} />;
}
