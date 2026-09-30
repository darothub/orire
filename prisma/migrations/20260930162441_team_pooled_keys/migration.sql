-- CreateTable
CREATE TABLE "TeamKey" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "label" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamKey_teamId_idx" ON "TeamKey"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamKey_teamId_provider_key" ON "TeamKey"("teamId", "provider");

-- AddForeignKey
ALTER TABLE "TeamKey" ADD CONSTRAINT "TeamKey_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
