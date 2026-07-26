import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import {
  getSeriesDetail,
  getAllSeries,
} from "@/lib/server-api";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const getCachedSitemapEntries = unstable_cache(
  async (): Promise<MetadataRoute.Sitemap> => {
    const result: MetadataRoute.Sitemap = [];
    const list = await getAllSeries();
    const detailResults = await Promise.allSettled(
      list.items.map((series) =>
        getSeriesDetail(series.slug, { fresh: false }),
      ),
    );

    for (const detailResult of detailResults) {
      if (detailResult.status === "rejected") continue;
      const series = detailResult.value;
      const episodes = series.seasons.flatMap((season) => season.episodes);
      const latestPublishedAt = episodes.reduce<string | undefined>(
        (latest, episode) =>
          !latest || Date.parse(episode.publishedAt) > Date.parse(latest)
            ? episode.publishedAt
            : latest,
        undefined,
      );

      result.push({
        url: absoluteUrl(`/series/${series.slug}`),
        lastModified: latestPublishedAt,
        changeFrequency: series.status === "ongoing" ? "weekly" : "monthly",
        priority: 0.8,
        images: series.coverUrl
          ? [absoluteUrl(series.coverUrl)]
          : undefined,
      });

      for (const episode of episodes) {
        result.push({
          url: absoluteUrl(`/read/${episode.id}`),
          lastModified: episode.publishedAt,
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    }

    return result;
  },
  ["sitemap-entries"],
  { revalidate: 300 },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const result: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  try {
    result.push(...(await getCachedSitemapEntries()));
  } catch {
    return result;
  }

  return result;
}
