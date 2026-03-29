-- Rename to clarify: not the in-person アポ日, but when the result was logged in the system
ALTER TABLE "calling_records" RENAME COLUMN "createdAt" TO "result_captured_at";
