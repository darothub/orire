-- Explicitly saved OCC conversation transcripts. No CV/JD raw document storage.
CREATE TABLE "OccConversation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'New conversation',
  "primaryAgent" TEXT NOT NULL DEFAULT 'review',
  "usedAgents" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OccConversation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OccMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "sender" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "agentId" TEXT,
  "sequence" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OccMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OccConversation_userId_updatedAt_idx" ON "OccConversation"("userId", "updatedAt");
CREATE UNIQUE INDEX "OccMessage_conversationId_sequence_key" ON "OccMessage"("conversationId", "sequence");
CREATE INDEX "OccMessage_conversationId_createdAt_idx" ON "OccMessage"("conversationId", "createdAt");
ALTER TABLE "OccConversation" ADD CONSTRAINT "OccConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OccMessage" ADD CONSTRAINT "OccMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "OccConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
