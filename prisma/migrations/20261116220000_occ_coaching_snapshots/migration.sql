-- P6B opt-in coaching snapshots. No backfill of previously saved transcripts.
CREATE TABLE "OccCoachingSnapshot" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageSequence" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OccCoachingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OccCoachingSnapshot_conversationId_messageSequence_key"
  ON "OccCoachingSnapshot"("conversationId", "messageSequence");
CREATE INDEX "OccCoachingSnapshot_conversationId_createdAt_idx"
  ON "OccCoachingSnapshot"("conversationId", "createdAt");

ALTER TABLE "OccCoachingSnapshot" ADD CONSTRAINT "OccCoachingSnapshot_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "OccConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
