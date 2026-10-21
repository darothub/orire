-- Idempotency ledger for lifecycle/activation nudge emails (P1-12), so the
-- cron sweep that sends them never double-sends. One row per (user, kind).
-- The "has this user activated" signals themselves are read from existing
-- tables (ExportEvent, UsageCounter) rather than duplicated here.
CREATE TABLE "LifecycleEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LifecycleEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LifecycleEmail_userId_kind_key" ON "LifecycleEmail"("userId", "kind");

CREATE INDEX "LifecycleEmail_userId_idx" ON "LifecycleEmail"("userId");

ALTER TABLE "LifecycleEmail" ADD CONSTRAINT "LifecycleEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
