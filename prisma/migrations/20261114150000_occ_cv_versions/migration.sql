CREATE TABLE "OccCvVersion" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "savedUpdatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OccCvVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OccCvVersion_documentId_key" ON "OccCvVersion"("documentId");
CREATE INDEX "OccCvVersion_userId_createdAt_idx" ON "OccCvVersion"("userId", "createdAt");
ALTER TABLE "OccCvVersion" ADD CONSTRAINT "OccCvVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OccCvVersion" ADD CONSTRAINT "OccCvVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
