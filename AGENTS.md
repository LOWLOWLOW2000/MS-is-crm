## Phase 1（MVP）最優先ルール（IS_01）

### リポジトリ境界・フェーズ（2026-04-05）

- **`twenty/`** は **この IS_01 ツリーに含めたまま**運用する（別 Git リポジトリに分離しない）。
- 開発ルーム全体は **当面すべて実験フェーズ** とする。詳細は **`my-dev-room/AGENTS.md` の「Git・実験フェーズ」** を参照。

この `IS_01` は Phase 1（MVP）を **デプロイまで**最短で持っていくことを最優先とする。

### 優先順位
- **Phase 1（MVP）> デプロイ安定化 > それ以外**
- 仕様追加・リファクタ・UI改善は、MVPの Done 条件を満たしてから行う

### コーディング規約（このワークスペース共通の継承）
- TypeScript は **セミコロン省略**
- **関数型寄り**（`map` / `filter` / `reduce` を優先）
- スタイルは **Tailwind CSS クラスで完結**
- 変数名・関数名は **英語**（日本語禁止）
- コメントは **JSDoc 形式で必要最小限**
- `console.log` はデバッグ時のみ、提出前に削除
- テストは **vitest** 推奨（可能な範囲でユニットテスト）

### IS_01 の作業範囲（MVP）
- **Web**: `apps/web`（Next.js App Router）
- **API**: `apps/api`（NestJS）
- このPhaseでは「動く最小」を優先し、画面の見栄えや拡張は後回しにする

### デプロイに向けた必須チェック
- `.env.example` と実装の環境変数が一致している
- 起動手順が `package.json` scripts で一貫している（`start:dev` / `dev:*`）
- 生成物（例: `.next-*`）はリポジトリに混入させない

### ドキュメントの正
- ルートの共通ルール: `my-dev-room/.cursor/rules/*`
- Phase 1 の状況: `OLD/docs/phase1-status.md`（過去履歴として）
- **用語・命名の正**: `docs/GLOSSARY.md`（DB / API / UI の概念名。PR では辞書と違う名前を増やさない）
- **リポジトリ入口**: `README.md`（workspaces の `npm install` 手順、`ListItem.callingResult` の更新経路）

### 工事中エリアの見せ方（人間向け）
- **`UnderConstructionOverlay`**（`apps/web/components/UnderConstructionOverlay.tsx`）でラップする
- 中身はそのまま表示しつつ、上に **白 50%**（`bg-white/50`）＋中央に **`/images/koujichu-mark.png`** の工事中マークを重ねる
- **`markSize="compact"`** … 左メニュー対象の一覧ページ向けにマークを小さめ表示
- 左メニューの「工事中」バッジと対応付けは **`MockNav.tsx`** の `MOCK_NAV_UNDER_CONSTRUCTION_HREFS`
- 例: `/director/kpi-goals` の「IS個別 KPI目標」ブロックのみ（`markSize` 省略可）
- 別ブロックを工事表示にしたいときも同じコンポーネントを使う（セレクタ固定ではなくラッパーで表現する）

### IS_01 固有で扱う範囲（全体ルールには入れない）
- 特定機能の実装仕様（例: `/director/requests` の仕様）
- DBスキーマ・seed方針の個別判断
- UI部品レベルの具体規約（アプリ差分が出るもの）

### Front_AJ / Back_AJ 並列運用ルール（IS_01）
- 役割名は固定して使う
  - `Front_AJ`: `apps/web` のUI実装（表示状態・導線・操作性）
  - `Back_AJ`: `apps/api` のAPI実装（DTO・欠損耐性・順序・エラーハンドリング）
- 開始時の手順
  - `Back_AJ` が API の型契約を先に確定し、`Front_AJ` はその型を参照して実装開始する
  - `GET /reports/ai-scorecard` のような連携APIは、レスポンスの null/空配列時の扱いを先に明文化する
- 変更通知の最小フォーマット（3行）
  - 何を変更したか
  - 影響範囲（Web/API/テスト）
  - 相手側の追従作業の有無
- 完了前クロスチェック
  - `Back_AJ` は `Front_AJ` の loading/error/empty 前提と API 仕様が一致しているかを確認
  - `Front_AJ` は API 変更で表示崩れ・型崩れが出ていないか確認
- 記録
  - 詰まり、回避策、次回注意は `CONTEXT.md` に短く追記
