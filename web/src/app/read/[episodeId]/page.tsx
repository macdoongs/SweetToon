import { EpisodeReaderPage } from "@/components/episode-reader-page";

export default async function Page({
  params,
}: {
  params: Promise<{ episodeId: string }>;
}) {
  const { episodeId } = await params;
  return <EpisodeReaderPage episodeId={episodeId} />;
}
