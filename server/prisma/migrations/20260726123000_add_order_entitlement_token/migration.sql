ALTER TABLE "Order" ADD COLUMN "entitlementToken" TEXT;

UPDATE "Order"
SET "entitlementToken" = CASE
  WHEN "providerOrderId" LIKE 'mock_seed_%' THEN gen_random_uuid()::text
  ELSE COALESCE("requestKey", gen_random_uuid()::text)
END;

ALTER TABLE "Order"
ALTER COLUMN "entitlementToken" SET NOT NULL;

CREATE UNIQUE INDEX "Order_entitlementToken_key"
ON "Order"("entitlementToken");
