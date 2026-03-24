import path from 'path'
import { config } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

/** Prisma CLI は cwd が不定でも apps/api/.env のみを使う */
config({
  path: path.resolve(__dirname, '.env'),
  override: process.env.NODE_ENV === 'production' ? false : true,
})

/** Prisma CLI 7.x の接続・マイグレーション・シード設定 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
