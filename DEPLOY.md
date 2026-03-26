## Phase 1（MVP）デプロイ直前チェック（IS_01）

このドキュメントは「デプロイ直前まで行ける状態」を作るための最短手順。

### 0) 前提
- Node.js / npm が利用できる
- DB は Supabase(PostgreSQL) または PostgreSQL を用意できる

### 1) 環境変数
#### Web（Next.js）
- `apps/web/.env.local` を作成（例は `apps/web/.env.example`）

#### API（NestJS）
- `.env`（または運用の環境変数）で `DATABASE_URL` 等を設定する

### 2) 依存関係
リポジトリ直下（`IS_01/`）で実行。

```bash
npm ci
```

### 3) 本番ビルド（必須）
```bash
cd apps/api && npm run build
cd ../web && npm run build
```

### 4) 本番起動（ローカル確認）
#### API
```bash
cd apps/api
node dist/main.js
```

#### Web
```bash
cd apps/web
npm run start
```

### 5) ヘルスチェック
- API: `GET /health` が `{"status":"ok" ...}` を返す

### 6) 生成物を混入させない
- `.next-dev/`, `.next-build/`, `*.tsbuildinfo` はコミット対象に含めない（`.gitignore` 済み）
