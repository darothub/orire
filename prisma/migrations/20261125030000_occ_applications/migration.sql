CREATE TABLE "OccApplication" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'saved',
  "link" TEXT,
  "notes" TEXT NOT NULL DEFAULT '',
  "documentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OccApplication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OccApplication_userId_updatedAt_idx" ON "OccApplication"("userId", "updatedAt");
ALTER TABLE "OccApplication" ADD CONSTRAINT "OccApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
