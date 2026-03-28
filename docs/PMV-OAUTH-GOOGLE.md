# PMV: Google OAuth セットアップ（NextAuth + Nest 交換）

Web は **NextAuth**（`apps/web/lib/auth.ts`）が Google の ID トークンを受け取り、バックエンドの **`POST /auth/google/exchange`** にメール・表示名を渡して IS の JWT を発行します。

## 1. Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成（または既存を選択）。
2. **API とサービス → 認証情報 → 認証情報を作成 → OAuth 2.0 クライアント ID**。
3. アプリケーションの種類: **ウェブアプリケーション**。
4. **承認済みのリダイレクト URI** に次を追加（環境ごとに増やす）:
   - ローカル Web: `http://localhost:3000/api/auth/callback/google`
   - 本番 Web: `https://<your-domain>/api/auth/callback/google`
5. クライアント ID とクライアントシークレットを控える。

## 2. Web（`apps/web`）の環境変数

`.env.local`（またはデプロイ先のシークレット）に設定:

| 変数 | 説明 |
|------|------|
| `NEXTAUTH_URL` | フロントの公開オリジン（例: `http://localhost:3000`）。本番は実 URL。 |
| `NEXTAUTH_SECRET` | ランダムな長文字列（`openssl rand -base64 32` など）。 |
| `GOOGLE_CLIENT_ID` | Console で発行したクライアント ID。 |
| `GOOGLE_CLIENT_SECRET` | クライアントシークレット。 |
| `API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL` | Nest API のベース（例: `http://localhost:3001`）。 |

`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` が両方入っているときだけ `lib/auth.ts` が **GoogleProvider** を登録します。どちらか欠けると Google ログインボタンは出てもプロバイダが無く失敗します。

## 3. API（`apps/api`）

OAuth ユーザー作成・トークン発行は既存の `POST /auth/google/exchange` を利用します。API 側に Google のクライアント秘密は不要（Web が NextAuth で完結）ですが、メールドメインとテナント紐付けは `AuthService` のポリシーに依存します。開発用シードユーザーと同じドメインで試すか、招待フローを通してください。

## 4. 動作確認

1. `apps/api` と `apps/web` を起動。
2. `/login` で **Google でログイン**。
3. 成功後 `/pj-switch` 等へリダイレクトされ、セッションに `accessToken` が付くことを確認。

## 5. Microsoft を隠す（PMV）

ログイン画面では既定で Microsoft ボタンを出しません。必要なら Web に `NEXT_PUBLIC_ENABLE_MICROSOFT_OAUTH=true` と Azure 用の `AZURE_*` / `auth.ts` の設定を追加してください。
