'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'

/**
 * ログイン画面。認証で一般的な要素を網羅。データ取り扱い同意・アカウント作成はストレージ接続必須。
 */
/** callbackUrl が同一オリジンならリダイレクト先に使う（オープンリダイレクト防止） */
const safeCallbackPath = (raw: string | null): string | null => {
  if (!raw || raw.length === 0) return null
  try {
    if (raw.startsWith('/')) {
      return raw.startsWith('//') ? null : raw
    }
    const u = new URL(raw)
    if (typeof window !== 'undefined' && u.origin !== window.location.origin) return null
    return `${u.pathname}${u.search}${u.hash}`
  } catch {
    return null
  }
}

export default function LoginPage() {
  const [dataUsageAgreed, setDataUsageAgreed] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // アカウント作成用
  const [createUserId, setCreateUserId] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState('')
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [storageApiEndpoint, setStorageApiEndpoint] = useState('')
  const [storageApiKey, setStorageApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    setIsSubmitting(true)
    try {
      const result = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      })
      if (result?.error) {
        setLoginError('メールまたはパスワードが正しくありません')
        setIsSubmitting(false)
        return
      }
      const q = new URLSearchParams(window.location.search)
      const fromQuery = safeCallbackPath(q.get('callbackUrl'))
      window.location.href = fromQuery ?? '/pj-switch'
    } catch {
      setLoginError('ログインに失敗しました')
    }
    setIsSubmitting(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-gray-900">ログイン</h1>
        <p className="mb-6 text-sm text-gray-500">
          OAuth（Google）・メール認証。開発中はテキストで開発・IS・ディレクター・メアド・パスを記載。
        </p>

        {/* ログインフォーム：メール・パスワード・ログイン状態を保持・パスワードを忘れた・送信 */}
        <form onSubmit={handleLogin} className="mb-6 space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1 block text-xs font-medium text-gray-700">
              メールアドレス <span className="text-red-600">必須</span>
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              placeholder="example@company.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-invalid={!!loginError}
              aria-describedby={loginError ? 'login-error' : undefined}
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1 block text-xs font-medium text-gray-700">
              パスワード <span className="text-red-600">必須</span>
            </label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-invalid={!!loginError}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <span className="text-xs">非表示</span>
                ) : (
                  <span className="text-xs">表示</span>
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                autoComplete="off"
              />
              <span className="text-xs text-gray-700">ログイン状態を保持する</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              パスワードをお忘れの方
            </Link>
          </div>
          {loginError && (
            <p id="login-error" className="text-xs text-red-600" role="alert">
              {loginError}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>

        {/* OAuth認証：代表的なソーシャル（Google / Microsoft）アイコン付き */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-gray-500">または</span>
            </div>
          </div>
          <p className="mt-4 mb-2 text-center text-xs font-medium text-gray-600">OAuth認証</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => signIn('google', { callbackUrl: '/pj-switch' })}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google でログイン
            </button>
            <button
              type="button"
              onClick={() => signIn('azure-ad', { callbackUrl: '/pj-switch' })}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                <path fill="#F25022" d="M1 1h10v10H1z" />
                <path fill="#00A4EF" d="M1 13h10v10H1z" />
                <path fill="#7FBA00" d="M13 1h10v10H13z" />
                <path fill="#FFB900" d="M13 13h10v10H13z" />
              </svg>
              Microsoft でログイン
            </button>
          </div>
        </div>

        <p className="mb-6 text-center text-xs text-gray-500">
          新規で企業アカウントを作る方は{' '}
          <Link href="/register-company" className="text-blue-600 hover:underline">
            企業登録（管理者＋ディレクター）
          </Link>
        </p>
        <div className="mb-8 flex gap-4">
          <Link
            href="/office"
            className="rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Office へ（開発用）
          </Link>
          <Link
            href="/"
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            トップへ
          </Link>
        </div>

        {/* アカウント作成：データ取り扱い同意（必須）→ ストレージ接続 → その他ならAPI認証＋ID・メール・パスワード */}
        <section className="border-t border-gray-200 pt-6" aria-labelledby="account-create-heading">
          <h2 id="account-create-heading" className="mb-4 text-base font-semibold text-gray-900">
            アカウント作成
          </h2>

          {/* データの取り扱いについて ＋ 同意チェック（必須） */}
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
            <h3 id="data-usage-heading" className="mb-2 text-sm font-semibold text-gray-900">
              データの取り扱いについて
            </h3>
            <p className="mb-3 text-xs leading-relaxed text-gray-700">
              弊社は情報の観点から、ユーザーのデータを弊社に保持していません。AIの返答生成のため、人名・番号など個人・プライバシー・機密の語句を
              <strong>ハッシュ化</strong>し、さらにAIにより<strong>抽象化（＝暗号化）</strong>したデータとして弊社へ送信します。これらは
              <strong>AIの回答品質向上にのみ利用</strong>することを明示いたします。
            </p>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={dataUsageAgreed}
                onChange={(e) => setDataUsageAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                aria-describedby="data-usage-heading"
                aria-required="true"
              />
              <span className="text-xs text-gray-700">
                上記のデータ取り扱い（ハッシュ化・抽象化のうえAI回答向上にのみ利用）に同意する
                <span className="ml-1 text-red-600" aria-hidden>必須</span>
              </span>
            </label>
          </div>

          <p className="mb-3 text-xs text-amber-800">
            オンラインストレージまたはローカルストレージの接続が必須です。
          </p>
          <p className="mb-3 text-xs text-gray-500">
            API認証のあるストレージを利用すると、データの保存・同期を安全に管理できます。
          </p>
          <ul className="mb-3 space-y-2 text-xs">
            <li>
              <a
                href={process.env.NEXT_PUBLIC_AFFILIATE_GOOGLE_DRIVE ?? 'https://www.google.com/drive/'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google Drive
              </a>
              <span className="text-gray-600"> — 15GB無料（Googleアカウントで使用可）</span>
            </li>
            <li>
              <a
                href={process.env.NEXT_PUBLIC_AFFILIATE_ONEDRIVE ?? 'https://www.microsoft.com/ja-jp/microsoft-365/onedrive/online-cloud-storage'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                OneDrive
              </a>
              <span className="text-gray-600"> — 5GB無料（Microsoftアカウント）</span>
            </li>
            <li>
              <a
                href={process.env.NEXT_PUBLIC_AFFILIATE_ICLOUD ?? 'https://www.icloud.com/'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                iCloud
              </a>
              <span className="text-gray-600"> — 5GB無料（Apple製品向け）</span>
            </li>
            <li>
              <a
                href={process.env.NEXT_PUBLIC_AFFILIATE_BOX ?? 'https://www.box.com/ja-jp/home'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Box
              </a>
              <span className="text-gray-600"> — 10GB無料</span>
            </li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled
              className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500"
              title="準備中"
            >
              その他（API認証Storage）
            </button>
          </div>
          <p className="mt-3 text-[10px] text-gray-400">
            アフィリエイト設定時は .env に NEXT_PUBLIC_AFFILIATE_GOOGLE_DRIVE 等を指定してください。推奨：API認証が用意されているストレージでアカウント用データを保持してください。
          </p>

          {/* その他Storage：APIエンドポイント・APIキー ＋ アカウントID・メール・パスワード・利用規約同意 */}
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
            <p className="mb-3 text-xs font-medium text-gray-700">
              その他（API認証Storage）を選択した場合：
            </p>
            <ul className="mb-3 list-inside list-disc text-xs text-gray-600">
              <li>ストレージのAPI認証設定（エンドポイントURL・APIキー）</li>
              <li>アカウントのID・メールアドレス・パスワードの設定</li>
            </ul>
            <div className="space-y-3">
              <div>
                <label htmlFor="storage-api-endpoint" className="mb-1 block text-xs font-medium text-gray-700">
                  ストレージAPI エンドポイント
                </label>
                <input
                  id="storage-api-endpoint"
                  type="url"
                  value={storageApiEndpoint}
                  onChange={(e) => setStorageApiEndpoint(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled
                />
              </div>
              <div>
                <label htmlFor="storage-api-key" className="mb-1 block text-xs font-medium text-gray-700">
                  APIキー <span className="text-red-600">必須</span>
                </label>
                <div className="relative">
                  <input
                    id="storage-api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={storageApiKey}
                    onChange={(e) => setStorageApiKey(e.target.value)}
                    placeholder="ストレージ発行のAPIキーを入力"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-14 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoComplete="off"
                    disabled
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-200 disabled:opacity-50"
                    aria-label={showApiKey ? 'APIキーを隠す' : 'APIキーを表示'}
                    tabIndex={-1}
                    disabled
                  >
                    {showApiKey ? '非表示' : '表示'}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="create-user-id" className="mb-1 block text-xs font-medium text-gray-700">
                  ユーザーID <span className="text-red-600">必須</span>
                </label>
                <input
                  id="create-user-id"
                  type="text"
                  value={createUserId}
                  onChange={(e) => setCreateUserId(e.target.value)}
                  autoComplete="username"
                  placeholder="半角英数字など"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled
                />
              </div>
              <div>
                <label htmlFor="create-email" className="mb-1 block text-xs font-medium text-gray-700">
                  メールアドレス <span className="text-red-600">必須</span>
                </label>
                <input
                  id="create-email"
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="example@company.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled
                />
              </div>
              <div>
                <label htmlFor="create-password" className="mb-1 block text-xs font-medium text-gray-700">
                  パスワード <span className="text-red-600">必須</span>
                </label>
                <div className="relative">
                  <input
                    id="create-password"
                    type={showCreatePassword ? 'text' : 'password'}
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="8文字以上推奨"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    aria-label={showCreatePassword ? 'パスワードを隠す' : 'パスワードを表示'}
                    tabIndex={-1}
                    disabled
                  >
                    <span className="text-xs">{showCreatePassword ? '非表示' : '表示'}</span>
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="create-password-confirm" className="mb-1 block text-xs font-medium text-gray-700">
                  パスワード（確認） <span className="text-red-600">必須</span>
                </label>
                <input
                  id="create-password-confirm"
                  type={showCreatePassword ? 'text' : 'password'}
                  value={createPasswordConfirm}
                  onChange={(e) => setCreatePasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="同じパスワードを再入力"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled
                />
              </div>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled
                />
                <span className="text-xs text-gray-700">
                  <Link href="/terms" className="text-blue-600 hover:underline">利用規約</Link>
                  {' および '}
                  <Link href="/privacy" className="text-blue-600 hover:underline">プライバシーポリシー</Link>
                  に同意する
                </span>
              </label>
            </div>
            <p className="mt-3 text-[10px] text-gray-400">
              エンドポイント（任意）とAPIキー（必須）でストレージと接続し、上記を入力してアカウントを作成します。（準備中）
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
