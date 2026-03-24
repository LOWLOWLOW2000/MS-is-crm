import path from 'path'
import { config } from 'dotenv'

/**
 * cwd に依存せず apps/api/.env を読む。
 * API 起動・Prisma・seed が同じ DATABASE_URL を参照するための単一参照点（main から最初に import）。
 */
const envPath = path.resolve(__dirname, '..', '.env')
/** 開発時: シェルに誤った DATABASE_URL が残っていても apps/api/.env を正とする。本番はプラットフォームの env を優先 */
config({
  path: envPath,
  override: process.env.NODE_ENV === 'production' ? false : true,
})
