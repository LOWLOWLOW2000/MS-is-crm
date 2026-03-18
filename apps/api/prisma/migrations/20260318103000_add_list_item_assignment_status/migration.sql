-- list_items に担当割当と進捗ステータスを追加
ALTER TABLE "list_items" ADD COLUMN "assignedToUserId" TEXT;
ALTER TABLE "list_items" ADD COLUMN "assignedAt" TEXT;
ALTER TABLE "list_items" ADD COLUMN "assignedByUserId" TEXT;
ALTER TABLE "list_items" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'unstarted';
ALTER TABLE "list_items" ADD COLUMN "statusUpdatedAt" TEXT;
ALTER TABLE "list_items" ADD COLUMN "completedAt" TEXT;

CREATE INDEX "list_items_tenantId_assignedToUserId_idx" ON "list_items"("tenantId", "assignedToUserId");
CREATE INDEX "list_items_tenantId_status_idx" ON "list_items"("tenantId", "status");

