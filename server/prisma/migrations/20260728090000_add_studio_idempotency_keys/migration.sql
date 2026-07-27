ALTER TABLE "Series"
ADD COLUMN "requestKey" TEXT,
ADD COLUMN "requestFingerprint" TEXT;

ALTER TABLE "Episode"
ADD COLUMN "requestKey" TEXT,
ADD COLUMN "requestFingerprint" TEXT;

ALTER TABLE "PackagingRequest"
ADD COLUMN "requestKey" TEXT,
ADD COLUMN "requestFingerprint" TEXT;

CREATE UNIQUE INDEX "Series_requestKey_key" ON "Series"("requestKey");
CREATE UNIQUE INDEX "Episode_requestKey_key" ON "Episode"("requestKey");
CREATE UNIQUE INDEX "PackagingRequest_requestKey_key"
ON "PackagingRequest"("requestKey");
