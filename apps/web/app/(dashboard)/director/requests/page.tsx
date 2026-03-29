'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { fetchDirectorRequests, fetchDirectorRequestsSummary, markDirectorRequestsAsRead } from '@/lib/calling-api'
import type { DirectorRequestRow, DirectorRequestSummary, DirectorRequestType } from '@/lib/types'

const formatTypeJa = (t: DirectorRequestType): string => (t === 'appointment' ? 'アポ' : '資料請求')

const formatIso = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * ディレクター用: アポ/資料請求（= 架電結果: アポ/資料送付）の管理ページ
 */
export default function DirectorRequestsPage() {
  const { data: session, status } = useSession()
  const accessToken = (session as unknown as { accessToken?: string } | null)?.accessToken ?? null

  const [loading, setLoading] = useState(false)
  const [markingRead, setMarkingRead] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<DirectorRequestRow[]>([])
  const [summary, setSummary] = useState<DirectorRequestSummary | null>(null)
  const [typeFilter, setTypeFilter] = useState<'all' | DirectorRequestType>('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const matchedType = typeFilter === 'all' || r.type === typeFilter
        const matchedUnread = !unreadOnly || !r.isRead
        return matchedType && matchedUnread
      }),
    [rows, typeFilter, unreadOnly],
  )

  useEffect(() => {
    if (!accessToken) return
    void refreshData()
  }, [accessToken])

  const refreshData = async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const [s, list] = await Promise.all([
        fetchDirectorRequestsSummary(accessToken),
        fetchDirectorRequests(accessToken),
      ])
      setSummary(s)
      setRows(list)
      setSelectedIds([])
    } catch (e) {
      setError(e instanceof Error ? e.message : '取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
  }

  const markSelectedRead = async () => {
    if (!accessToken || selectedIds.length === 0) return
    setMarkingRead(true)
    setError(null)
    try {
      await markDirectorRequestsAsRead(accessToken, { ids: selectedIds })
      await refreshData()
    } catch (e) {
      setError(e instanceof Error ? e.message : '既読化に失敗しました')
    }
    setMarkingRead(false)
  }

  const markAllRead = async () => {
    if (!accessToken) return
    setMarkingRead(true)
    setError(null)
    try {
      await markDirectorRequestsAsRead(accessToken, { markAll: true })
      await refreshData()
    } catch (e) {
      setError(e instanceof Error ? e.message : '既読化に失敗しました')
    }
    setMarkingRead(false)
  }

  if (status === 'loading') {
    return <div className="text-sm text-gray-500">読み込み中…</div>
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">アポ・資料請求 管理</h1>
          <p className="mt-1 text-sm text-gray-600">
            ISからの報告（架電結果: <span className="font-medium">アポ / 資料送付</span>）を一覧で確認します
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={markSelectedRead}
            disabled={selectedIds.length === 0 || markingRead}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            選択を既読
          </button>
          <button
            type="button"
            onClick={markAllRead}
            disabled={markingRead}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            全件既読
          </button>
          <label className="text-xs font-medium text-gray-700">フィルタ</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | DirectorRequestType)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="all">すべて</option>
            <option value="appointment">アポ</option>
            <option value="material">資料請求</option>
          </select>
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
            />
            未読だけ表示
          </label>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void refreshData()}
              disabled={loading}
              className="rounded border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
            >
              再読み込み
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700">
            <span>
              表示件数: <span className="font-semibold text-gray-900">{filtered.length}</span>
            </span>
            <span>
              未読: <span className="font-semibold text-red-600">{summary?.unreadTotal ?? 0}</span>
            </span>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
              <tr>
                <th className="border-b border-gray-200 px-4 py-2">既読</th>
                <th className="border-b border-gray-200 px-4 py-2">種別</th>
                <th className="border-b border-gray-200 px-4 py-2">アポ取得日時</th>
                <th className="border-b border-gray-200 px-4 py-2">会社名</th>
                <th className="border-b border-gray-200 px-4 py-2">担当IS</th>
                <th className="border-b border-gray-200 px-4 py-2">URL</th>
                <th className="border-b border-gray-200 px-4 py-2">メモ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={7}>
                    読み込み中…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={7}>
                    対象データがありません
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className={`hover:bg-gray-50 ${r.isRead ? 'opacity-70' : ''}`}>
                    <td className="border-b border-gray-100 px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        disabled={r.isRead || markingRead}
                        onChange={() => toggleSelect(r.id)}
                      />
                    </td>
                    <td className="border-b border-gray-100 px-4 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.type === 'appointment'
                            ? 'bg-green-50 text-green-800 ring-1 ring-green-200'
                            : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                        }`}
                      >
                        {formatTypeJa(r.type)}
                      </span>
                    </td>
                    <td className="border-b border-gray-100 px-4 py-2 text-gray-700">{formatIso(r.resultCapturedAt)}</td>
                    <td className="border-b border-gray-100 px-4 py-2 font-medium text-gray-900">{r.companyName}</td>
                    <td className="border-b border-gray-100 px-4 py-2 text-gray-700">{r.createdByName ?? '—'}</td>
                    <td className="border-b border-gray-100 px-4 py-2">
                      <a
                        href={r.targetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        開く
                      </a>
                    </td>
                    <td className="border-b border-gray-100 px-4 py-2 text-gray-700">{r.memo || '—'}</td>
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

