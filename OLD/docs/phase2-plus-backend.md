# Phase 2 以降で追加したバックエンド一覧

## スキーマ変更（要マイグレーション）

- **CallTranscription** … ZOOM録音バッチ→Whisper文字起こし結果の保存用。`callRecordId`, `transcriptionText`, `transcribedAt` など。
- **Tenant** … Phase4 マルチテナント用雛形。
- **Plan** … Phase4 プラン・課金用雛形。

```bash
cd apps/api && npx prisma db push
# または
npx prisma migrate dev --name add-phase2-transcription-and-tenant-plan
```

---

## Phase 2

### 録音・文字起こし
- **POST /calling/transcriptions** … バッチが文字起こし結果を保存。body: `callRecordId`, `transcriptionText`, `zoomMeetingId?`, `durationSeconds?`, `transcribedAt?`。developer / is_admin のみ。
- **GET /calling/records/:callRecordId/transcription** … 架電記録に紐づく文字起こしを1件取得。

### ディレクター囁き
- **POST /director/whisper** … body: `requestId`, `message`。対象ヘルプリクエストの `requestedBy`（IS）に WebSocket `director:message` で配信。director / is_admin 等のみ。

### スクリプト PDF
- **POST /scripts/upload-pdf** … multipart `file`。スタブ: 固定テキスト＋`suggestedTabName: 'PDF取り込み'` を返す。実抽出は Python 等で実装予定。

---

## Phase 3

### レポート
- **GET /reports/ai-scorecard** … CallingAiEvaluation が存在する架電を一覧化。IS別・overallScore・evaluation 付きで返却（実データ）。
- **GET /reports/golden-patterns** … スタブ。`{ patterns: [], period: 'monthly' }`。
- **GET /reports/optimal-time-map** … スタブ。`{ heatmap: [], period: 'monthly' }`。
- **GET /reports/pipeline-forecast** … スタブ。`{ forecast: {}, period: 'monthly' }`。

---

## Phase 4 雛形

- **Tenant**, **Plan** モデルを Prisma に追加済み。API は未実装（テナント登録・プラン管理は別タスクで実装）。

---

## WebSocket イベント追加

- **director:message** … `DirectorWhisperEvent`: `requestId`, `tenantId`, `toUserId`, `fromUserId`, `message`, `sentAt`。クライアントは `toUserId` が自分なら表示。
