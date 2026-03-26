## Phase 1（MVP）最優先ルール（IS_01）

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
