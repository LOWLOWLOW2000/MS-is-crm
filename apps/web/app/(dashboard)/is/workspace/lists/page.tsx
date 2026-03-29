'use client'

import Link from 'next/link'
import { useCallingListRows } from '@/lib/hooks/use-calling-list-rows'
import { SALES_ROOM_V2_BASE } from '@/lib/sales-room-paths'

/**
 * 配布リストの一覧把握と架電ルームへの導線
 */
export default function IsWorkspaceListsPage() {
  const { rows, hint, loading, openCompanyFromRow } = useCallingListRows()

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">リスト</h1>
          <p className="mt-2 text-lg text-gray-800">
            あなたに配布された架電リストの明細です。行を選んで架電ルームを開けます。
          </p>
        </div>
        <Link
          href={SALES_ROOM_V2_BASE}
          className="inline-flex min-h-[48px] items-center justify-center rounded-lg border-2 border-blue-600 bg-blue-600 px-4 text-lg font-semibold text-white hover:bg-blue-700"
        >
          架電ルームを開く
        </Link>
      </header>

      {hint ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-950" role="status">
          {hint}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-base">
            <thead className="bg-gray-100 text-left text-sm font-bold uppercase tracking-wide text-gray-800">
              <tr>
                <th className="border-b border-gray-200 px-4 py-3">会社名</th>
                <th className="border-b border-gray-200 px-4 py-3">電話</th>
                <th className="border-b border-gray-200 px-4 py-3">URL</th>
                <th className="border-b border-gray-200 px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-700" colSpan={4}>
                    読み込み中…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-700" colSpan={4}>
                    表示する行がありません
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="border-b border-gray-100 px-4 py-3 font-semibold text-gray-900">
                      {r.companyName}
                    </td>
                    <td className="border-b border-gray-100 px-4 py-3 text-gray-800">{r.phone ?? '—'}</td>
                    <td className="border-b border-gray-100 px-4 py-3">
                      {r.targetUrl ? (
                        <a
                          href={r.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 underline font-medium"
                        >
                          開く
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="border-b border-gray-100 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openCompanyFromRow(r)}
                        className="rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                      >
                        コックピットで開く
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
