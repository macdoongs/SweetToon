-- Add a stable, human-readable route key without losing the existing seeded data.
ALTER TABLE "Series" ADD COLUMN "slug" TEXT;

UPDATE "Series"
SET "slug" = CASE "title"
  WHEN '달빛 세탁소' THEN 'moonlight-laundry'
  WHEN '골목 끝 편의점' THEN 'corner-store'
  WHEN '네온 검객' THEN 'neon-blade'
  WHEN '옥상 정원 클럽' THEN 'rooftop-garden'
  ELSE "id"
END;

ALTER TABLE "Series" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Series_slug_key" ON "Series"("slug");
