CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

CREATE INDEX "Order_isDemo_status_updatedAt_idx"
ON "Order"("isDemo", "status", "updatedAt");

CREATE INDEX "Order_seasonId_idx" ON "Order"("seasonId");

CREATE INDEX "Order_seriesId_idx" ON "Order"("seriesId");

CREATE INDEX "OrderEvent_orderId_createdAt_idx"
ON "OrderEvent"("orderId", "createdAt");
