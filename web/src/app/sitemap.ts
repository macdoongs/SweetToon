import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { getSitemapDiscovery } from "@/lib/server-api";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const getCachedSitemapEntries = unstable_cache(
  async (): Promise<MetadataRoute.Sitemap> => {
    const result: MetadataRoute.Sitemap = [];
    const discovery = await getSitemapDiscovery();

    for (const series of discovery.series) {
      result.push({
        url: absoluteUrl(`/series/${series.slug}`),
        lastModified: series.updatedAt,
        changeFrequency: series.status === "ongoing" ? "weekly" : "monthly",
        priority: 0.8,
        images: series.coverUrl
          ? [absoluteUrl(series.coverUrl)]
          : undefined,
      });
    }

    for (const episode of discovery.episodes) {
      result.push({
        url: absoluteUrl(`/read/${episode.id}`),
        lastModified: episode.updatedAt,
        changeFrequency: "monthly",
        priority: 0.6,
      });
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
