## 外部リスト（クライアント固定フォーマット）同期仕様（IS01）

### 目的
- クライアント提供の「1行=1社」リストを崩さずに運用する
- 自社側で `clientRowId`（企業名+電話番号から生成）を永続キーとして持ち、架電ログ・録音・文字起こしを蓄積する
- IS01 の `ListItem` と `CallingRecord` を同調させる（`listItemId` 指定で `ListItem.callingResult` 更新）

### キー
- `clientRowNo`: クライアント列 `No`（ファイル内の採番。永続ではない）
- `clientRowId`: 自社生成の永続ID（企業名 + 電話番号のみ）
  - `companyNameNorm = trim + 連続空白を1つに`
  - `phoneNorm = 数字のみ`
  - `clientRowId = cr_ + sha1(companyNameNorm + "|" + phoneNorm).slice(0,16)`
- `listItemId`: IS01 の `ListItem.id`

### 対応表（Mapping）
- IS01 側DBは変更せず、対応表は自社スプレッドシート（`Mappings` シート）で保持する
- 目的: `clientRowId ↔ listItemId` を確実に解決する

### API（管理者向け）
- `POST /calling/external-mappings/compute-client-row-id`
  - 入力: `{ companyName, companyPhone }`
  - 出力: `{ companyNameNorm, phoneNorm, clientRowId }`
  - 用途: スプシ/運用で `clientRowId` を生成・確認

- `POST /calling/external-call-logs`
  - 入力: `CreateExternalCallLogDto`
  - 動作:
    - `listItemId` を指定して `CallingRecord` を作成
    - 指定時は文字起こしも保存（`CallTranscription`）
  - 出力: `{ callingRecord, listItemId }`

### 自社スプレッドシート（推奨）
- `Mappings` シート（対応表）
  - `clientRowNo`, `clientRowId`, `companyNameSnapshot`, `phoneSnapshot`, `listItemId`, `mappingSource`, `mappingConfidence`, `updatedAt`

- `CallLogs` シート（1行=1通話の集計）
  - 既出の `CallLogs` ヘッダに、最低限 `clientRowNo` と `clientRowId` を含める

- `CallEvents` シート（複数行=1通話のターンログ）
  - `callId`, `turnIndex`, `speaker`, `text`, `intent`, `matchedRuleId`, `replyTemplateId`, `variantId`, `frontTalkPackId`, `frontTalkStepId`, `latencyE2Ems`

