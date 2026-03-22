import Link from 'next/link'

/** パスワード再発行（プレースホルダー）。ログイン画面のリンク先 404 を防ぐ */
export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="text-lg font-semibold text-gray-900">パスワードをお忘れの方</h1>
      <p className="mt-2 text-sm text-gray-600">再発行フローは今後実装予定です。</p>
      <Link href="/login" className="mt-6 inline-block text-sm text-blue-600 hover:underline">
        ログインへ戻る
      </Link>
    </div>
  )
}
