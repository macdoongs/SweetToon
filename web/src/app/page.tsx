import type { Metadata } from "next";
import { HomePage } from "@/components/home-page";
import { JsonLd } from "@/components/json-ld";
import { getAllSeries, getSeriesList } from "@/lib/server-api";
import {
  parseGenre,
  parseSeriesFilter,
  parseWeekday,
} from "@/lib/series-filter";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "웹툰을 읽고 단행본으로 소장하는 곳",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string | string[];
    genre?: string | string[];
    weekday?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const filters = {
    filter: parseSeriesFilter(query.filter),
    genre: parseGenre(query.genre),
    weekday: parseWeekday(query.weekday),
  };
  const [data, recommendations] = await Promise.all([
    getSeriesList(filters),
    getAllSeries(),
  ]);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          alternateName: "스위트툰",
          url: SITE_URL,
          description: SITE_DESCRIPTION,
          inLanguage: "ko-KR",
        }}
      />
      <HomePage
        activeFilters={filters}
        initialData={data}
        recommendationSeries={recommendations.items}
        key={`${filters.filter}:${filters.genre ?? ""}:${filters.weekday ?? ""}`}
      />
    </>
  );
}
