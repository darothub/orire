-- What a chat was about: a plain reference to the saved CV version (no FK, so
-- deleting the version never deletes the chat) and the job description text.
ALTER TABLE "OccConversation" ADD COLUMN "cvDocumentId" TEXT;
ALTER TABLE "OccConversation" ADD COLUMN "jobDescription" TEXT;
