'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { createListReviewCompletion } from '@/lib/calling-api'

/**
 * 未調査リスト精査: 精査完了を API へ記録する。
 */
export function RefinementPageClient() {
  const { data: session, status } = useSession()
  const [companyName, setCompanyName] = useState('')
  const [targetUrl, setTargetUrl] = useState('https://example.com')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setMessage(null)
    setError(null)
    if (!session?.accessToken) {
      setError('ログインが必要です')
      return
    }
    const name = companyName.trim()
    if (!name) {
      setError('企業名を入力してください')
      return
    }
    setSubmitting(true)
    try {
      const res = await createListReviewCompletion(session.accessToken, {
        companyName: name,
        targetUrl: targetUrl.trim() || 'https://example.com',
      })
      setMessage(`保存しました（ID: ${res.id}）`)
      setCompanyName('')
    } catch {
      setError('保存に失敗しました（URL が有効か、ネットワークを確認）')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex gap-4">
      <aside className="w-72 shrink-0 space-y-4">
        <span className="inline-block rounded-md bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-800">
          未調査リスト精査
        </span>
        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">精査完了の記録</h2>
          <p className="mt-2 text-xs text-gray-500">
            POST /calling/list-review-completions に送信します（精査完了 ID は発信検証に利用されます）。
          </p>
          {status !== 'authenticated' ? (
            <p className="mt-3 text-sm text-amber-800">ログインしてください。</p>
          ) : (
            <div className="mt-3 space-y-2">
              <label className="block text-xs font-medium text-gray-700">
                企業名
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  maxLength={120}
                  className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
                  placeholder="株式会社サンプル"
                />
              </label>
              <label className="block text-xs font-medium text-gray-700">
                対象 URL
                <input
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
                  placeholder="https://..."
                />
              </label>
              {error ? <p className="text-xs text-red-600">{error}</p> : null}
              {message ? <p className="text-xs text-green-700">{message}</p> : null}
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmit()}
                className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? '送信中…' : '精査完了を記録'}
              </button>
            </div>
          )}
        </section>
        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">一括承認（プレースホルダ）</h2>
          <p className="mt-2 text-xs text-gray-500">バッチ承認 API 接続時に有効化予定。</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled
              className="rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-500"
            >
              一括承認
            </button>
            <button
              type="button"
              disabled
              className="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-500"
            >
              却下
            </button>
          </div>
        </section>
      </aside>
      <div className="flex-1 rounded-md border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">HP・INFO・検索窓</h2>
        <p className="mt-1 text-xs text-gray-500">企業HP、情報、検索（表示エリアは今後 API 連携）</p>
        <input
          type="search"
          placeholder="企業名・URL・メモで検索"
          className="mt-4 w-full max-w-md rounded-md border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="mt-6 flex h-48 items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
          HP・INFO 表示エリア
        </div>
      </div>
    </div>
  )
}
