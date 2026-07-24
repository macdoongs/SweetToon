import { SeriesDetailPage } from "@/components/series-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <SeriesDetailPage slug={slug} />;
}
