'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  const { error, reset } = props
  const isDev = process.env.NODE_ENV === 'development'

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-semibold">問題が発生しました</h2>
      <p className="text-sm text-gray-600">しばらくしてから再度お試しください。</p>
      {isDev && (
        <pre className="max-h-40 max-w-full overflow-auto rounded border border-red-200 bg-red-50 p-3 text-left text-xs text-red-800">
          {error.message}
        </pre>
      )}
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          再試行
        </button>
        <Link href="/" className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
          トップへ
        </Link>
      </div>
    </div>
  )
}
