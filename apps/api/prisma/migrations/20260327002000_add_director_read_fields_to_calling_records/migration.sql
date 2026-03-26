-- Add unread management columns for director requests badge
ALTER TABLE "calling_records"
ADD COLUMN "directorReadAt" TEXT,
ADD COLUMN "directorReadBy" TEXT;

-- Speed up unread queries for director requests summary/list
CREATE INDEX "calling_records_tenantId_result_directorReadAt_idx"
ON "calling_records"("tenantId", "result", "directorReadAt");
