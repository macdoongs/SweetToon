export type ShortsPreviewItem = {
  series: {
    slug: string;
    title: string;
    synopsis: string;
    genre: string;
    coverUrl: string | null;
    authorName: string;
  };
  episode: {
    id: string;
    number: number;
    title: string;
    likeCount: number;
  };
  pages: Array<{
    id: string;
    order: number;
    imageUrl: string;
  }>;
};

export type ShortsPreviewResponse = {
  items: ShortsPreviewItem[];
};
