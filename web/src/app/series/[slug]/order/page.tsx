import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderFormPage } from "@/components/order-form-page";
import { getSeriesDetail, ServerApiError } from "@/lib/server-api";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    season?: string | string[];
    volume?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "소장본 주문",
  description: "완결된 웹툰 시즌의 판형과 표지를 골라 소장본을 주문합니다.",
  robots: { index: false, follow: false },
};

export default async function Page({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const seasonId = Array.isArray(query.season)
    ? query.season[0]
    : query.season;
  const volumeValue = Array.isArray(query.volume)
    ? query.volume[0]
    : query.volume;
  const volumeNumber = Number(volumeValue);

  let series: Awaited<ReturnType<typeof getSeriesDetail>>;
  try {
    series = await getSeriesDetail(slug);
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const season = series.seasons.find(
    (candidate) =>
      candidate.id === seasonId && candidate.status === "completed",
  );
  if (!season) {
    notFound();
  }
  const volumeEpisodes = season.episodes.filter(
    (episode) => episode.volumeNumber === volumeNumber,
  );
  if (
    !Number.isInteger(volumeNumber) ||
    volumeNumber < 1 ||
    volumeEpisodes.length === 0
  ) {
    notFound();
  }

  return (
    <OrderFormPage
      season={season}
      series={series}
      volumeEpisodes={volumeEpisodes}
      volumeNumber={volumeNumber}
    />
  );
}
