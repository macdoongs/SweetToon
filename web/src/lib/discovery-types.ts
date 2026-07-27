export type SitemapDiscoverySeries = {
  slug: string;
  status: string;
  coverUrl: string | null;
  updatedAt: string;
};

export type DiscoveryEpisode = {
  id: string;
  number: number;
  title: string;
  publishedAt: string;
  updatedAt: string;
  series: {
    slug: string;
    title: string;
    synopsis: string;
    genre: string;
    authorName: string;
  };
};

export type SitemapDiscoveryResponse = {
  series: SitemapDiscoverySeries[];
  episodes: DiscoveryEpisode[];
};

export type RecentEpisodesResponse = {
  items: DiscoveryEpisode[];
};
