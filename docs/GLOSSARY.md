# IS-CRM 用語辞書（Glossary）

DB・API・UI をまたぐ名前のブレを防ぐための**正**。実装や PR 説明でもここに寄せる。

## PR レビュー基準

- **辞書と異なる概念名・列の別名を UI や DTO に新規に持ち込む変更は却下**（必要なら本ファイルを先に更新し、レビューで合意する）。
- 後方互換のため API クエリ名だけが辞書と違う場合は、**JSDoc で「辞書上の意味」を必ず書く**（例: `statuses` 実体は架電結果）。

## コア用語

| 概念 | DB / Prisma | API レスポンス | UI での呼び方（推奨） | 混同禁止 |
|------|-------------|----------------|------------------------|----------|
| リスト明細の**進捗** | `ListItem.status` | `status` | 「進捗」「リスト状態」 | 架電結果と同一視しない |
| **架電結果**（★架電ルーム） | `ListItem.callingResult` | `callingResult` | 「架電結果」「★架電ルーム」 | `status` や別名フィルタに流用しない |
| 架電結果の**正規名** | 上記カラムに保存する文字列 | `CallingResultType` と同一 | チェックボックスのラベル（現状は正規名＝日本語ラベル） | 英語コードや略称を DB に直書きしない |

`CallingResultType` と値の配列の **単一ソース（SSOT）** は npm パッケージ **`@is-crm/domain`**（`packages/is-domain`）。API・Web は `@/lib/calling-result-canonical` または API 側の同名ファイルから再エクスポートを経由して参照する。

## 「calling-result で何を指すか」（相談への回答）

以前提案した **calling-result/** という区画の意味は次の3層に分けると整理しやすいです。

1. **正規名（canonical）**  
   - DB・API・配布フィルタで使う**固定語彙**（例: `アポ`, `折り返し依頼`）。  
   - **置き場所**: `packages/is-domain/src/calling-result-canonical.ts`（SSOT）。

2. **表示ラベル（label）**  
   - 画面上に出す文字。現状は多くが正規名と**同じ日本語**。  
   - 将来「社内用短縮表示」などに分けたくなったら、ラベルだけ別定義にできる。

3. **スラッグ（slug）**  
   - URL クエリや左セレクトの `id` 用の**英数字キー**（例: `appo`, `callback`）。  
   - **置き場所**: Web の `apps/web/lib/sales-room-calling-result-ui.ts`（`CALLING_RESULT_SLUG_BY_VALUE` など）。**DB には保存しない**（正規名へ変換してから保存する）。

つまり **「calling-result モジュール」＝正規名＋正規化**、**表示・URL 用の薄い層は Web 側の presentation**、という分担です。

## 参照

- `ListItem.callingResult` の更新経路: リポジトリ直下 `README.md` の「ListItem.callingResult の更新経路」
- Phase 1 ルール: `AGENTS.md`
