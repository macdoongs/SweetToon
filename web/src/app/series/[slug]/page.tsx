import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { SeriesDetailPage } from "@/components/series-detail-page";
import {
  getSeriesDetail,
  ServerApiError,
} from "@/lib/server-api";
import { absoluteUrl } from "@/lib/site";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    sort?: string | string[];
    volume?: string | string[];
  }>;
};

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    const series = await getSeriesDetail(slug);
    const title = `${series.title} - ${series.author.name} 웹툰`;
    const canonical = `/series/${series.slug}`;
    const images = [
      { url: absoluteUrl("/opengraph-image"), alt: "SweetToon" },
      ...(series.coverUrl
        ? [{ url: absoluteUrl(series.coverUrl), alt: `${series.title} 표지` }]
        : []),
    ];

    return {
      title,
      description: series.synopsis,
      alternates: { canonical },
      openGraph: {
        type: "article",
        locale: "ko_KR",
        url: canonical,
        title,
        description: series.synopsis,
        images,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: series.synopsis,
        images: images.map((image) => image.url),
      },
    };
  } catch {
    return {
      title: "작품을 찾을 수 없습니다",
      robots: { index: false, follow: false },
    };
  }
}

export default async function Page({
  params,
  searchParams,
}: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const sortValue = Array.isArray(query.sort) ? query.sort[0] : query.sort;
  const sort = sortValue === "latest" ? "latest" : "oldest";
  const volumeValue = Array.isArray(query.volume)
    ? query.volume[0]
    : query.volume;
  const volume =
    volumeValue && /^[a-z0-9]+:\d+$/.test(volumeValue)
      ? volumeValue
      : undefined;
  let series: Awaited<ReturnType<typeof getSeriesDetail>>;

  try {
    series = await getSeriesDetail(slug);
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CreativeWorkSeries",
          name: series.title,
          description: series.synopsis,
          genre: series.genre,
          image: series.coverUrl
            ? absoluteUrl(series.coverUrl)
            : undefined,
          url: absoluteUrl(`/series/${series.slug}`),
          inLanguage: "ko-KR",
          author: {
            "@type": "Person",
            name: series.author.name,
          },
        }}
      />
      <SeriesDetailPage
        activeSort={sort}
        activeVolume={volume}
        initialData={series}
        key={`${slug}:${sort}:${volume ?? ""}`}
        slug={slug}
      />
    </>
  );
}
