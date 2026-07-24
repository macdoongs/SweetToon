ALTER TABLE "Order"
ADD COLUMN "requestKey" TEXT,
ADD COLUMN "providerOrderId" TEXT,
ADD COLUMN "pageCount" INTEGER,
ADD COLUMN "currency" TEXT DEFAULT 'KRW',
ADD COLUMN "unitPrice" INTEGER,
ADD COLUMN "totalPrice" INTEGER,
ADD COLUMN "estimatedBusinessDays" INTEGER;

CREATE UNIQUE INDEX "Order_requestKey_key" ON "Order"("requestKey");
CREATE UNIQUE INDEX "Order_providerOrderId_key" ON "Order"("providerOrderId");
