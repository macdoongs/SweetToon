ALTER TABLE "Episode" ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "EpisodeLike" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "viewerHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EpisodeLike_episodeId_viewerHash_key"
ON "EpisodeLike"("episodeId", "viewerHash");

CREATE INDEX "EpisodeLike_episodeId_idx" ON "EpisodeLike"("episodeId");

ALTER TABLE "EpisodeLike"
ADD CONSTRAINT "EpisodeLike_episodeId_fkey"
FOREIGN KEY ("episodeId") REFERENCES "Episode"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
