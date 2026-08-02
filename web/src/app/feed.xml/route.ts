import { getRecentEpisodes } from "@/lib/server-api";
import {
  absoluteUrl,
  SITE_DESCRIPTION,
  SITE_NAME,
} from "@/lib/site";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET(): Promise<Response> {
  const { items } = await getRecentEpisodes(50);
  const episodes = [...items]
    .sort(
      (left, right) =>
        Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
    );

  const itemsXml = episodes
    .map((episode) => {
      const episodeUrl = absoluteUrl(`/read/${episode.id}`);
      const title =
        `${episode.series.title} ${episode.number}화 — ${episode.title}`;

      return [
        "    <item>",
        `      <title>${escapeXml(title)}</title>`,
        `      <link>${escapeXml(episodeUrl)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(episodeUrl)}</guid>`,
        `      <description>${escapeXml(episode.series.synopsis)}</description>`,
        `      <dc:creator>${escapeXml(episode.series.authorName)}</dc:creator>`,
        `      <category>${escapeXml(episode.series.genre)}</category>`,
        `      <pubDate>${new Date(episode.publishedAt).toUTCString()}</pubDate>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const feedUrl = absoluteUrl("/feed.xml");
  const lastBuildDate = episodes[0]?.publishedAt;
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    `    <title>${escapeXml(`${SITE_NAME} 새 회차`)}</title>`,
    `    <link>${escapeXml(absoluteUrl("/"))}</link>`,
    `    <description>${escapeXml(SITE_DESCRIPTION)}</description>`,
    "    <language>ko-KR</language>",
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    ...(lastBuildDate
      ? [`    <lastBuildDate>${new Date(lastBuildDate).toUTCString()}</lastBuildDate>`]
      : []),
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
