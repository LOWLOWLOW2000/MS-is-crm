-- Persona にメールアドレスを追加
ALTER TABLE "personas" ADD COLUMN IF NOT EXISTS "email" TEXT;
