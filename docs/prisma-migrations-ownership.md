## 結論
複数アプリが同じ Postgres（または同じ schema 群）を使う場合、**migration を実行する主体は必ず 1つ**に寄せてください。

## 推奨運用
- **migration オーナー**: `apps/IS_01/apps/api`（Prisma を持つこのアプリ）
- **実行場所**: CI の単独ジョブ（`prisma migrate deploy`）
- **他アプリ**: migration は実行せず、必要なら “期待スキーマの検査” のみ

## なぜ単独にするか
- 共有DBで複数プロセスが migrate を走らせると、ロック/順序/partial failure の事故が起きやすい
- “起動時 migrate” は、特にプール接続や自動スケールと相性が悪い

## Supabase を使う場合の注意
- migrate/seed は **direct 接続（`DIRECT_URL`）** を推奨（pooler は避ける）
- アプリ実行は pooler を使う（`DATABASE_URL`）

