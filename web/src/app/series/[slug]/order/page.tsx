import type { Metadata } from "next";
import Link from "next/link";
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

  const matchedSeason = series.seasons.find(
    (candidate) => candidate.id === seasonId,
  );
  // 실제로 존재하는 연재 중 시즌은 404 대신 주문 불가 안내로 방어한다.
  if (matchedSeason && matchedSeason.status !== "completed") {
    return (
      <main className="orders-error">
        <section className="orders-empty">
          <h2>이 권은 시즌 완결 후 주문할 수 있어요.</h2>
          <p>
            시즌 {matchedSeason.number}은 아직 연재 중입니다. 완결되면
            소장본으로 주문할 수 있어요. 그동안은 캔디로 유료 회차를 열 수
            있습니다.
          </p>
          <Link
            className="button button--primary"
            href={`/series/${encodeURIComponent(series.slug)}#episodes`}
          >
            회차 목록으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }
  const season = matchedSeason;
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
