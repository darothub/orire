-- Shareable hosted CV link (P1-5): an opt-in, revocable public share token per
-- Document. When set, the CV is readable at /cv/<shareToken>; null = private.
-- Additive + nullable; no data change for existing rows (all stay private).

ALTER TABLE "Document" ADD COLUMN "shareToken" TEXT;
ALTER TABLE "Document" ADD COLUMN "sharedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Document_shareToken_key" ON "Document"("shareToken");
