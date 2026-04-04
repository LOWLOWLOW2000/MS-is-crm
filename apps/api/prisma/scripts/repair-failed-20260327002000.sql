-- =============================================================================
-- Supabase（本番含む）で次のエラーが出たとき:
--   P3009 ... migration `20260327002000_add_director_read_fields_to_calling_records` failed
--
-- 手順:
--   1) Supabase Dashboard → SQL Editor でこのファイル全文を実行（冪等）
--   2) ローカルで apps/api に cd し、DATABASE_URL が同じ DB を指すことを確認
--   3) npm run db:migrate:resolve:director-read
--   4) npm run db:migrate:deploy
--
-- その後、必要なら npm run db:seed（データは消えない。シードは upsert 前提）
-- =============================================================================

ALTER TABLE "calling_records" ADD COLUMN IF NOT EXISTS "directorReadAt" TEXT;
ALTER TABLE "calling_records" ADD COLUMN IF NOT EXISTS "directorReadBy" TEXT;

-- 失敗時にインデックスだけ未作成の可能性があるため、DROP してから作り直す
DROP INDEX IF EXISTS "calling_records_tenantId_result_directorReadAt_idx";
CREATE INDEX "calling_records_tenantId_result_directorReadAt_idx"
  ON "calling_records"("tenantId", "result", "directorReadAt");
