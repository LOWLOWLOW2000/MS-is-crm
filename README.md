# IS-CRM（`apps/IS_01`）

Phase 1（MVP）向けの Web（Next.js）と API（NestJS）のモノレポです。

## インストールと共有パッケージ `@is-crm/domain`

`apps/api` と `apps/web` の `package.json` は `@is-crm/domain` を **`file:../../packages/is-domain`** で参照しています。次のいずれかでよいです。

1. **API / Web それぞれで `npm install`**（推奨・通常はこれで十分）
   ```bash
   cd apps/IS_01/apps/api && npm install
   cd apps/IS_01/apps/web && npm install
   ```
2. 共有パッケージをビルドしてから（`main` が `dist` を指すため、初回や型定義更新後に実行）
   ```bash
   cd apps/IS_01 && npm run build:domain
   ```

`postinstall` で domain の `prepare` が毎回走ると重い場合は、`packages/is-domain/package.json` の `prepare` を外し、上記 `build:domain` を CI / 手動だけにしてもよいです。

## 用語・レビュー基準

- **[docs/GLOSSARY.md](./docs/GLOSSARY.md)** … DB / API / UI で使う名前の正。PR では辞書と矛盾する命名を増やさないこと。

## ListItem.callingResult の更新経路

**本番想定で `callingResult` を書き換えるコード経路は、原則として次のみです。** 新規経路を追加する場合は **PR でレビュー必須**かつ **本節と GLOSSARY を更新**してください。

| # | 経路 | 用途 |
|---|------|------|
| 1 | `CallingService.saveRecord`（`CreateCallingRecordDto.listItemId` 指定時） | 架電記録保存に伴い、紐づくリスト明細の架電結果・進捗を更新 |
| 2 | `prisma/seed.ts`（および開発者が手で書くシード・マイグレーション用 SQL） | 開発・検証データの投入のみ |

**読み取りのみ**（更新しない）の例: 条件付き配布の `ListsService.buildDistributeTargetWhere`、一覧 `getListItems` など。

## レイアウト

- `apps/web` … Next.js
- `apps/api` … NestJS + Prisma
- `packages/is-domain` … API / Web 共通ドメイン（架電結果の正規名など）

詳細は [AGENTS.md](./AGENTS.md) を参照してください。
