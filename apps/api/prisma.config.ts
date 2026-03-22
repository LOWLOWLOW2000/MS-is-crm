import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

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
