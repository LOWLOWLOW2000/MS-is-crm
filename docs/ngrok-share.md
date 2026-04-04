# 仲間にローカル（開発中）を見せる（ngrok）

**やることは「順番どおりに 3 つ」だけです。** 途中で `.env` を変えたら **そのあと再起動**が必要なのは Web / API どちらも同じです。

### 一発で（APP 再起動 → ngrok）

```bash
npm run ngrok:tunnel
```

`scripts/ngrok/NGROKﾄﾝﾈﾙ起動.sh` が、既存の `ngrok http 3000`・ポート **3000 / 3001** を止めてから `npm run start:dev` をバックグラウンドで立ち上げ、`http://localhost:3000` を待ってから **`ngrok http 3000`** を前面で起動します。ログは `$TMPDIR/is01-ngrok-dev.log`（未設定時は `/tmp`）。

---

## ① いつもの開発サーバーを起動（先）

リポジトリルートで:

```bash
npm run start:dev
```

- Web: `http://localhost:3000` が開けるまで待つ  
- API: `http://localhost:3001`（`start:dev` が両方立てる想定）

**ここが動いていないと ngrok だけ立てても意味がありません。**

---

## ② ngrok を起動（あと）

**別ターミナル**で:

```bash
ngrok http 3000
```

- 表示された **`https://xxxx.ngrok-free.dev`（または `.app`）** をコピーして仲間に送る  
- 止めたいときはそのターミナルで `Ctrl+C`  
- 再起動すると **URL は変わる**（無料プランではよくある）。変わったら仲間に **新しい URL** を送り直す

**状態確認:** ブラウザで `http://127.0.0.1:4040` を開くと、ngrok のダッシュボードでトンネル状況が見られます。

---

## ③ どこまで見せるかで分岐

### A. 画面だけ・API をほぼ叩かない

- **① → ② だけでよい**（`.env` 変更不要のことが多い）

### B. 画面から API も使う（一覧・保存など）

1. **もう 1 本トンネル**（**別ターミナル**）:

   ```bash
   ngrok http 3001
   ```

2. **Web の URL** を `WEB`、**API の URL** を `API` と呼ぶことにすると:

   - `apps/web/.env.local` に **追記または上書き**（例・値は自分の ngrok のホストに合わせる）:

     ```env
     NEXTAUTH_URL=https://（WEB のホスト）
     NEXT_PUBLIC_API_BASE_URL=https://（API のホスト）
     API_BASE_URL=https://（API のホスト）
     ```

   - `apps/api/.env` に **追記**:

     ```env
     CORS_EXTRA_ORIGINS=https://（WEB のホスト）
     WEB_BASE_URL=https://（WEB のホスト）
     ```

3. **① の `start:dev` を一度止めて、もう一度 `npm run start:dev`**（Web / API の両方が新しい環境変数を読むため）

---

## つまずきやすい所（短く）

| 現象 | 見る所 |
|------|--------|
| ngrok の URL が開かない | ① で 3000 が本当に LISTEN しているか |
| 画面は出るが API が失敗する | B の `.env` と **サーバー再起動**、API の `CORS_EXTRA_ORIGINS` |
| OAuth（Google 等）が通らない | ngrok の URL を Google Cloud のリダイレクト URI に追加する必要があることがある |

---

## authtoken について

初回だけ:

```bash
ngrok config add-authtoken （ダッシュボードのトークン）
```

トークンを **チャットや Git に貼らない**こと。漏れた可能性があるときはダッシュボードで **ローテーション**してから上をやり直す。
