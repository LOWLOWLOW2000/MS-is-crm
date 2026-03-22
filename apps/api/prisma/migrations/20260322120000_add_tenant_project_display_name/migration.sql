-- テナント単位のPJ表示名（ヘッダー用）
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "projectDisplayName" TEXT;
