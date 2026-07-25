import type { MetadataRoute } from "next";
import {
  getSeriesDetail,
  getAllSeries,
} from "@/lib/server-api";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const result: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  try {
    const list = await getAllSeries();
    const details = await Promise.all(
      list.items.map((series) => getSeriesDetail(series.slug)),
    );

    for (const series of details) {
      const episodes = series.seasons.flatMap((season) => season.episodes);
      const latestPublishedAt = episodes.at(-1)?.publishedAt;

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
  } catch {
    return result;
  }

  return result;
}
