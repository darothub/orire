-- CreateTable
CREATE TABLE "TeamAudit" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT,
    "targetId" TEXT,
    "targetName" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamAudit_teamId_createdAt_idx" ON "TeamAudit"("teamId", "createdAt");

-- AddForeignKey
ALTER TABLE "TeamAudit" ADD CONSTRAINT "TeamAudit_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
