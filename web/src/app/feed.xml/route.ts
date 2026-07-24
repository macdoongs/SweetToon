import { getSeriesList } from "@/lib/server-api";
import {
  absoluteUrl,
  SITE_DESCRIPTION,
  SITE_NAME,
} from "@/lib/site";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET(): Promise<Response> {
  const { items } = await getSeriesList();
  const episodes = items
    .flatMap((series) =>
      series.latestEpisode
        ? [{ series, episode: series.latestEpisode }]
        : [],
    )
    .sort(
      (left, right) =>
        Date.parse(right.episode.publishedAt) -
        Date.parse(left.episode.publishedAt),
    );

  const itemsXml = episodes
    .map(({ series, episode }) => {
      const episodeUrl = absoluteUrl(`/read/${episode.id}`);
      const title = `${series.title} ${episode.number}화 — ${episode.title}`;

      return [
        "    <item>",
        `      <title>${escapeXml(title)}</title>`,
        `      <link>${escapeXml(episodeUrl)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(episodeUrl)}</guid>`,
        `      <description>${escapeXml(series.synopsis)}</description>`,
        `      <author>${escapeXml(series.author.name)}</author>`,
        `      <category>${escapeXml(series.genre)}</category>`,
        `      <pubDate>${new Date(episode.publishedAt).toUTCString()}</pubDate>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const feedUrl = absoluteUrl("/feed.xml");
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(`${SITE_NAME} 새 회차`)}</title>`,
    `    <link>${escapeXml(absoluteUrl("/"))}</link>`,
    `    <description>${escapeXml(SITE_DESCRIPTION)}</description>`,
    "    <language>ko-KR</language>",
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    itemsXml,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
