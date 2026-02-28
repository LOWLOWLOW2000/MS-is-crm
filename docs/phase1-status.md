# Phase 1（MVP）完了状況と残タスク

## 完了済み

| 項目 | API | Web | 備考 |
|------|-----|-----|------|
| **認証（JWT + Google SSO）** | ✅ | ✅ | `auth/login`, `auth/google/exchange`, NextAuth Credentials + GoogleProvider |
| **ユーザー・権限管理（5種類）** | ✅ | △ | ロールはJWTで付与。GET /users（一覧）あり。**管理画面のユーザー一覧ページは未実装** |
| **URLリスト管理（CSVのみ）** | ✅ | ✅ | インポート・一覧・配布/解除・明細・架電開始リンク |
| **架電専用UI（左右分割・HP表示）** | ✅ | ✅ | 左: 会社情報・承認・発信・結果・メモ・次回架電・ディレクター呼出。右: タブ（企業HP iframe・スクリプト）・BGM。**左右比は固定（2/5・3/5）で、ドラッグリサイズは未実装** |
| **人間承認スイッチ** | ✅ | ✅ | GET/PUT /settings/calling, developer のみ OFF 変更可。架電画面で承認必須時は承認後に発信可能 |
| **ZOOM発信連携（Webhook）** | ✅ | ✅ | POST /zoom/dial-session（発信URL発行）, POST /zoom/webhook（検証・イベント受信）。運営側はログ保存しない方針 |
| **トークスクリプト（固定タブ・手動切替）** | ✅ | ✅ | スクリプトテンプレート CRUD、架電画面ではメイン/サブタブで手動切替 |
| **架電記録・メモ・ローカルキャッシュ** | ✅ | ✅ | POST /calling/records, calling-session-store（Zustand）+ 保存/次へ |
| **再架電登録・リマインド通知** | ✅ | ✅ | 記録の nextCallAt、scheduleRecallReminders、WebSocket recall:reminder、再架電一覧ページ |
| **BGM機能** | - | ✅ | 架電画面で再生/停止・音量スライダー・localStorage 保存 |
| **基本レポート（日次・週次・月次）** | ✅ | ✅ | GET /reports/summary?period=, GET /reports/by-member?period=, レポートページでCSV出力 |

## 未完了・要対応（残タスク）

### 1. 架電画面の右ペインをドラッグでリサイズ可能にする（.cursorrules 準拠）
- **内容**: `react-resizable-panels` で右ペイン内「企業HPエリア / スクリプトエリア」を縦分割し、divider をドラッグでリサイズ可能にする。デフォルト 70% / 30%、localStorage で比率保存。
- **現状**: パッケージは導入済みだが架電ページでは未使用。右側は固定レイアウト。

### 2. ユーザー一覧（管理）ページの追加
- **内容**: 管理者（developer / is_admin / enterprise_admin / director）がテナント内ユーザーを一覧表示するページ。GET /users を呼び、テーブル表示。
- **現状**: API は実装済み。Web に `/users` や「メンバー管理」などの画面がない。

### 3. （任意）レポート画面で IS 別実績を表示
- **内容**: 既存のレポートページに「ISメンバー別」タブまたはセクションを追加し、GET /reports/by-member の結果を表示する。
- **現状**: API は実装済み。レポートページは summary と CSV 出力のみ。

---

## サマリ

- **Phase 1 のうち、機能として「ほぼ完成」しているもの**: 認証、リスト管理、架電UI（HP表示・承認・ZOOM発信・記録・再架電・BGM）、設定、スクリプト、基本レポート（集計・CSV）。
- **仕様どおりに揃えるなら実施したい残タスク**:  
  1. 架電画面の **react-resizable-panels による右ペイン縦分割・ドラッグリサイズ**  
  2. **ユーザー一覧（管理）ページ**  
  3. （任意）**レポート画面での IS 別実績表示**
