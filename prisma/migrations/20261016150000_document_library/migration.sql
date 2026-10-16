-- Story 2 (CV version library, cloud-backed): promote the single working
-- Document into a real multi-version library.
--   * Document gains `company` (the library grouping key) and `lastExportedAt`
--     (mirrors the client version's exported flag).
--   * User gains `activeDocumentId` — an explicit pointer to the version open
--     in the editor, so autosave targets the right row even after switching to
--     an older version (vs. the former "most-recently-updated" heuristic).
--
-- Additive and nullable throughout, so existing single-document users keep
-- their working CV untouched; it simply becomes their first library version.

ALTER TABLE "Document" ADD COLUMN "company" TEXT;
ALTER TABLE "Document" ADD COLUMN "lastExportedAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN "activeDocumentId" TEXT;
