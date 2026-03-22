-- メンバー表示用プロフィール（管理BOX・一覧）
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "prefecture" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mobilePhone" TEXT;
