-- CreateTable
CREATE TABLE "ExportEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "template" TEXT,
    "company" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExportEvent_userId_idx" ON "ExportEvent"("userId");

-- AddForeignKey
ALTER TABLE "ExportEvent" ADD CONSTRAINT "ExportEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
