'use client'

import Link from 'next/link'

/**
 * 営業ルームセグメントのエラー表示。クライアント例外で真っ白になるのを防ぐ。
 */
export default function SalesRoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50/80 p-8 text-center">
      <h2 className="text-base font-semibold text-red-900">営業ルームの表示でエラーが発生しました</h2>
      <p className="max-w-md text-sm text-red-800">
        ブラウザの開発者ツール（F12）→ Console に詳細が出ていることがあります。広告オーバーレイの × を閉じたうえで再試行してください。
      </p>
      {process.env.NODE_ENV === 'development' && (
        <pre className="max-h-32 max-w-full overflow-auto rounded border border-red-200 bg-white p-2 text-left text-xs text-red-900">
          {error.message}
        </pre>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          再試行
        </button>
        <Link href="/dashboard" className="rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 hover:bg-gray-50">
          ダッシュボードへ
        </Link>
      </div>
    </div>
  )
}
