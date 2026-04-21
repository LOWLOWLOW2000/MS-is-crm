## 目的
- ローカル開発で DB 接続を安定させる（WSL2 でも落ちにくい）
- Supabase を使う場合に `pooler` / `direct` を用途で分け、`Tenant or user not found` 等を早期に切り分ける
- 複数アプリで「共通DB」を使うときに、事故リスクが低い運用（migration の単独実行など）に寄せる

## 推奨: ローカルは Docker Postgres を既定にする
このリポジトリは [`docker-compose.yml`](../docker-compose.yml) にローカル Postgres が含まれます。ローカル安定を最優先するなら、まずはここを既定にしてください。

- **メリット**: SSL / pooler / リージョン差分 / ネットワーク揺れを排除できる
- **デメリット**: 「全員が同一DBで検証」は別途 staging で行う必要がある

## Supabase を使う場合の接続の使い分け（重要）
Supabase では大きく次の 2 系統の接続があります。

- **pooler（pgbouncer 経由）**: `*.pooler.supabase.com`
  - **用途**: アプリ実行時（短いクエリ中心）
  - **注意**: マイグレーションや長いトランザクション用途には不向き
- **direct（直結）**: `db.<project-ref>.supabase.co`（プロジェクトにより表示が異なる場合あり）
  - **用途**: Prisma migrate / seed / 手動の `psql` など

このリポジトリ（`apps/api`）では、用途で環境変数を分けます。

- **`DATABASE_URL`**: アプリ実行用（pooler を推奨）
- **`DIRECT_URL`**: Prisma migrate/seed 用（direct を推奨）

`apps/api/prisma/schema.prisma` は `directUrl = env(\"DIRECT_URL\")` を参照します。

## `Tenant or user not found` の典型原因（アプリのテナントとは別）
このエラーはアプリの `tenantId` や認証ロジックより前、**接続先/資格情報の不一致**で発生しがちです。

- **project-ref 取り違え**（`postgres.<project-ref>` の `<project-ref>` が別プロジェクト）
- **pooler 用パスワードと direct 用パスワードの取り違え**
- **SSL 必須なのに `sslmode=require` がない**
- **migrate/seed に pooler を使っている**

## 早期検知（preflight）
API 起動時に DB preflight（`select 1`）を実行し、失敗時は次を **マスク付き**でログに出します。

- host / port / db / sslmode
- `DATABASE_URL`（password を `***` に置換した文字列）

実装は `apps/api/src/db/preflight-db.ts` を参照してください。

## 複数アプリで共通DBにする推奨パターン（事故リスク低）
将来、複数アプリで共通DBを使う場合は、次を推奨します。

- **1 DB / 複数 schema（アプリ単位で schema 分離） + 共通 schema（最小）**
  - 共通が必要なテーブルだけ `core` 等に集約
  - アプリ固有は `is01` / `appB` のように分離
  - migration の衝突とテーブル名衝突を抑えやすい

## migration の運用（最重要）
共通DBに対して migration を走らせる主体は **必ず1つ**に寄せてください。

- **CI の単独ジョブで `prisma migrate deploy`**
- アプリ起動時に migrate はしない（競合・ロック・順序の事故源）
- 他アプリは「実行」ではなく「期待スキーマの検査」に留める

