-- AlterTable
ALTER TABLE "calling_records" ADD COLUMN IF NOT EXISTS "structured_report" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "reporting_format_definitions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "schema_json" JSONB NOT NULL,
    "updated_by" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "reporting_format_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "reporting_format_definitions_tenantId_kind_key" ON "reporting_format_definitions"("tenantId", "kind");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reporting_format_definitions_tenantId_idx" ON "reporting_format_definitions"("tenantId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "list_item_director_notes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "list_item_id" TEXT NOT NULL,
    "body_markdown" TEXT NOT NULL DEFAULT '',
    "updated_by" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "list_item_director_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "list_item_director_notes_list_item_id_key" ON "list_item_director_notes"("list_item_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "list_item_director_notes_tenant_id_idx" ON "list_item_director_notes"("tenant_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'list_item_director_notes_list_item_id_fkey'
  ) THEN
    ALTER TABLE "list_item_director_notes" ADD CONSTRAINT "list_item_director_notes_list_item_id_fkey"
      FOREIGN KEY ("list_item_id") REFERENCES "list_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
