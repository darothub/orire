-- Idempotency ledger for "only successful refines decrement". The first
-- successful provider call in a run claims its run id here; that claim is what
-- consumes the refine credit, so a fully-failed run (AI error) costs nothing
-- and a two-column compare costs exactly one.
CREATE TABLE "ConsumedRefineRun" (
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumedRefineRun_pkey" PRIMARY KEY ("runId")
);

CREATE INDEX "ConsumedRefineRun_userId_idx" ON "ConsumedRefineRun"("userId");

ALTER TABLE "ConsumedRefineRun" ADD CONSTRAINT "ConsumedRefineRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
