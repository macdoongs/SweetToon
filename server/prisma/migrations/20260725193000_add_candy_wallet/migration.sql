-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "candyWalletToken" TEXT,
ADD COLUMN "candyBonus" INTEGER NOT NULL DEFAULT 0;

-- First-volume episodes are the default free preview policy.
ALTER TABLE "Series"
ALTER COLUMN "freeVolumeCount" SET DEFAULT 1,
ALTER COLUMN "previewEpisodeCount" SET DEFAULT 0;

UPDATE "Series"
SET "freeVolumeCount" = 1,
    "previewEpisodeCount" = 0
WHERE "freeVolumeCount" = 0
  AND "previewEpisodeCount" = 3;

-- CreateTable
CREATE TABLE "CandyWallet" (
    "token" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandyWallet_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "CandyTransaction" (
    "id" TEXT NOT NULL,
    "walletToken" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "requestKey" TEXT,
    "orderId" TEXT,
    "episodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandyEpisodeEntitlement" (
    "id" TEXT NOT NULL,
    "walletToken" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandyEpisodeEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandyTransaction_requestKey_key" ON "CandyTransaction"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "CandyTransaction_orderId_key" ON "CandyTransaction"("orderId");

-- CreateIndex
CREATE INDEX "CandyTransaction_walletToken_createdAt_idx" ON "CandyTransaction"("walletToken", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CandyEpisodeEntitlement_walletToken_episodeId_key" ON "CandyEpisodeEntitlement"("walletToken", "episodeId");

-- CreateIndex
CREATE INDEX "CandyEpisodeEntitlement_episodeId_idx" ON "CandyEpisodeEntitlement"("episodeId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_candyWalletToken_fkey" FOREIGN KEY ("candyWalletToken") REFERENCES "CandyWallet"("token") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandyTransaction" ADD CONSTRAINT "CandyTransaction_walletToken_fkey" FOREIGN KEY ("walletToken") REFERENCES "CandyWallet"("token") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandyTransaction" ADD CONSTRAINT "CandyTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandyEpisodeEntitlement" ADD CONSTRAINT "CandyEpisodeEntitlement_walletToken_fkey" FOREIGN KEY ("walletToken") REFERENCES "CandyWallet"("token") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandyEpisodeEntitlement" ADD CONSTRAINT "CandyEpisodeEntitlement_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
