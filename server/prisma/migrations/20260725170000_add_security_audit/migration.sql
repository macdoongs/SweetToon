CREATE TABLE "SecurityAuditEvent" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecurityAuditEvent_createdAt_idx"
ON "SecurityAuditEvent"("createdAt");

CREATE INDEX "SecurityAuditEvent_action_createdAt_idx"
ON "SecurityAuditEvent"("action", "createdAt");
