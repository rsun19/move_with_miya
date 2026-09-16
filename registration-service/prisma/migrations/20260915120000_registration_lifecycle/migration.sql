ALTER TABLE "Registration"
  ADD COLUMN "canceledAt" TIMESTAMP(3),
  ADD COLUMN "waitlistedAt" TIMESTAMP(3),
  ADD COLUMN "promotedAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'member';

CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutboxEvent_eventKey_key" ON "OutboxEvent"("eventKey");
CREATE INDEX "OutboxEvent_processedAt_availableAt_idx"
  ON "OutboxEvent"("processedAt", "availableAt");

CREATE INDEX "Registration_classId_status_registeredAt_idx"
  ON "Registration"("classId", "status", "registeredAt");
CREATE INDEX "Registration_classId_status_waitlistedAt_idx"
  ON "Registration"("classId", "status", "waitlistedAt");
CREATE INDEX "Registration_userId_status_idx"
  ON "Registration"("userId", "status");
