## 方針（monorepo）
- **アプリごとに `.env` の責務を持つ**（cwd に依存しない読み込みを強制する）
- **secret は Git に入れない**
- **CI/本番はプラットフォームの環境変数を正**として、`.env` はローカル専用に寄せる

## IS_01 の実装上の前提
### API（`apps/api`）
- `apps/api/src/preload-env.ts` が起動時に **必ず `apps/api/.env` を読む**
  - 開発では `override=true` のため、シェルに古い `DATABASE_URL` が残っていても `.env` が優先されます
- Prisma CLI も `apps/api/prisma.config.ts` で **`apps/api/.env` を読む**前提です

### Web（`apps/web`）
- 実体は `apps/web/.env.local`（Next.js の標準）に置き、テンプレは `apps/web/.env.example`

## 推奨: ローカル secret 注入の選択肢
このリポではまず「落ちない」ことが優先なので、次のいずれかを推奨します。

- **最小**: 各アプリに `.env` / `.env.local` を置く（Git には載せない）
- **チーム運用**: パスワード類は 1Password / Doppler 等から export し、direnv で注入する
  - `.envrc` は非secret（export のみ）、実体は vault から引く

## CI（推奨）
- migration は **単独ジョブ**で `apps/api` の Prisma だけが実行
- アプリ起動ジョブでは `prisma migrate` を実行しない（競合・順序の事故源）

