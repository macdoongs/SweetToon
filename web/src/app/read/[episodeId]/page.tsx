import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EpisodeReaderPage } from "@/components/episode-reader-page";
import { JsonLd } from "@/components/json-ld";
import { episodeLabel } from "@/lib/episode-label";
import { getEpisode, ServerApiError } from "@/lib/server-api";
import { absoluteUrl } from "@/lib/site";

type Props = {
  params: Promise<{ episodeId: string }>;
};

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { episodeId } = await params;

  try {
    const episode = await getEpisode(episodeId);
    const title = `${episode.series.title} ${episodeLabel(episode.number, episode.title)}`;
    const description = `${episode.series.title} 시즌 ${episode.season.number}의 ${episode.number}화를 세로 스크롤로 감상하세요.`;
    const canonical = `/read/${episode.id}`;
    const images = [
      {
        url: absoluteUrl("/opengraph-image"),
        alt: "SweetToon",
      },
      ...(episode.pages[0]
        ? [
            {
              url: absoluteUrl(episode.pages[0].imageUrl),
              alt: `${episode.series.title} ${episode.number}화`,
            },
          ]
        : []),
    ];

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        type: "article",
        locale: "ko_KR",
        url: canonical,
        title,
        description,
        publishedTime: episode.publishedAt,
        images,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: images?.map((image) => image.url),
      },
    };
  } catch {
    return {
      title: "에피소드를 찾을 수 없습니다",
      robots: { index: false, follow: false },
    };
  }
}

export default async function Page({
  params,
}: Props) {
  const { episodeId } = await params;
  let episode: Awaited<ReturnType<typeof getEpisode>>;

  try {
    episode = await getEpisode(episodeId);
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
          "@type": "ComicStory",
          name: `${episode.series.title} ${episodeLabel(episode.number, episode.title)}`,
          url: absoluteUrl(`/read/${episode.id}`),
          datePublished: episode.publishedAt,
          inLanguage: "ko-KR",
          image: episode.pages.map((page) =>
            absoluteUrl(page.imageUrl),
          ),
          isPartOf: {
            "@type": "CreativeWorkSeries",
            name: episode.series.title,
            url: absoluteUrl(`/series/${episode.series.slug}`),
          },
        }}
      />
      <EpisodeReaderPage
        episodeId={episodeId}
        initialData={episode}
        key={episodeId}
      />
    </>
  );
}
