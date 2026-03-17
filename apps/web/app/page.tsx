import Link from 'next/link'

/**
 * トップ。ヘッダー・フッター・サイドバーなし。メインのみ。
 */
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white text-center">
      <p className="mb-8 text-xl text-gray-900 whitespace-pre-line text-center">
        {'企業の最後の差別化要素は\n一次情報の差（アナタ）'}
      </p>
      <Link
        href="/login"
        className="rounded bg-gray-900 px-8 py-3 text-lg font-medium text-white hover:bg-gray-800"
      >
        MG_01入室
      </Link>
    </div>
  )
}
