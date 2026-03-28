'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useRecallListStore } from '@/lib/stores/recall-list-store'
import { useCallingListRows } from '@/lib/hooks/use-calling-list-rows'
import { SALES_ROOM_V2_BASE } from '@/lib/sales-room-paths'

const LIST_OPTIONS: { value: string; label: string }[] = [
  { value: 'list', label: 'リスト' },
  { value: 'ai', label: 'AIリスト' },
  { value: 'history', label: '架電履歴' },
  { value: 'reserve', label: '予約架電' },
]

const CLAIM_ROOM_PATH = '/sales-room/claim-room'
const CLASSIC_HOLD_PATH = '/sales-room'

const FLASH_NEAR_MS = 3 * 60 * 1000

const RECALL_LIST_PAGE_SIZE = 10

/**
 * 営業ルーム左パネル（ナビ下）。リストは API 共有フック、予約架電は recall ストア。
 * メインの `tab=list` / `listItemId` と同期。
 */
export function SalesRoomLeftPanel() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeListItemId = searchParams.get('listItemId') ?? ''
  const [listType, setListType] = useState('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [recallPage, setRecallPage] = useState(0)
  const recallItems = useRecallListStore((s) => s.items)
  const removeRecall = useRecallListStore((s) => s.remove)
  const { rows, hint, loading, openCompanyFromRow } = useCallingListRows()

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setRecallPage(0)
  }, [listType])

  const recallTotalPages = Math.max(1, Math.ceil(recallItems.length / RECALL_LIST_PAGE_SIZE))

  useEffect(() => {
    if (recallItems.length > 0 && recallPage >= recallTotalPages) setRecallPage(recallTotalPages - 1)
  }, [recallItems.length, recallPage, recallTotalPages])

  const filteredRows = useMemo(() => {
    if (listType === 'ai') {
      return rows.filter((r) => (r.aiListTier ?? '').toUpperCase() === 'A')
    }
    if (listType === 'history') {
      return rows.filter((r) => r.status !== 'unstarted')
    }
    if (!searchQuery.trim()) return rows
    const q = searchQuery.trim().toLowerCase()
    return rows.filter(
      (item) =>
        item.companyName.toLowerCase().includes(q) ||
        (item.phone ?? '').toLowerCase().includes(q) ||
        (item.address ?? '').toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q),
    )
  }, [rows, listType, searchQuery])

  const recallPageItems = useMemo(
    () =>
      recallItems.slice(
        recallPage * RECALL_LIST_PAGE_SIZE,
        (recallPage + 1) * RECALL_LIST_PAGE_SIZE,
      ),
    [recallItems, recallPage],
  )

  const listHref = `${SALES_ROOM_V2_BASE}?tab=list`

  return (
    <aside
      className="flex min-h-0 flex-1 flex-col bg-white animate-slideInLeft"
      aria-label="リスト一覧"
    >
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <div className="shrink-0 border-b border-gray-200 bg-gray-50 p-2 space-y-2">
          <div className="rounded border border-gray-200 bg-white p-1.5 space-y-1">
            <p className="text-[10px] font-semibold text-gray-700">保有リスト・結果</p>
            <Link
              href={CLASSIC_HOLD_PATH}
              className="block rounded bg-gray-50 py-1 text-center text-[10px] font-medium text-gray-800 hover:bg-gray-100"
            >
              保有リスト一覧（従来架電）
            </Link>
            <Link
              href={CLAIM_ROOM_PATH}
              className="block rounded border border-amber-200 bg-amber-50 py-1 text-center text-[10px] font-semibold text-amber-950 hover:bg-amber-100"
            >
              クレーム対応架電ルーム
            </Link>
          </div>
          <Link
            href={listHref}
            className="block w-full rounded border border-blue-200 bg-blue-50 py-1.5 text-center text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
          >
            一覧タブを開く
          </Link>
          <div className="flex gap-1">
            <select
              value={listType}
              onChange={(e) => setListType(e.target.value)}
              className="flex-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="リスト種別"
            >
              {LIST_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {listType !== 'reserve' ? (
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="検索..."
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="リスト検索"
            />
          ) : null}
          <p className="text-[10px] text-gray-400" aria-hidden>
            {listType === 'reserve' ? '再架電予定' : '部分一致・電話・ID'}
          </p>
          {hint && listType !== 'reserve' ? (
            <p className="text-[10px] text-amber-800">{hint}</p>
          ) : null}
          {loading && listType !== 'reserve' ? (
            <p className="text-[10px] text-gray-500">読み込み中…</p>
          ) : null}
        </div>
        {listType === 'reserve' && (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2">
            <span className="text-sm font-medium text-gray-900">再架電リスト一覧</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setRecallPage((p) => Math.max(0, p - 1))}
                disabled={recallPage <= 0}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50"
                aria-label="前のページ"
              >
                前
              </button>
              <button
                type="button"
                onClick={() => setRecallPage((p) => Math.min(recallTotalPages - 1, p + 1))}
                disabled={recallPage >= recallTotalPages - 1}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50"
                aria-label="次のページ"
              >
                次
              </button>
            </div>
          </div>
        )}
        <ul className="flex-1 space-y-0 overflow-auto p-2" aria-label={listType === 'reserve' ? '予約架電リスト' : '検索結果一覧'}>
          {listType === 'reserve' ? (
            recallItems.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-gray-500">
                架電リストは空です。行動結果で「再架電」を選び日時を指定して追加してください。
              </li>
            ) : (
              recallPageItems.map((item) => {
                const isNear = item.scheduledAt > now && item.scheduledAt - now <= FLASH_NEAR_MS
                const scheduledStr = new Date(item.scheduledAt).toLocaleString('ja-JP', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
                return (
                  <li
                    key={item.id}
                    className={`border-b border-gray-100 px-3 py-2 text-sm ${
                      isNear ? 'animate-recall-flash bg-amber-200/80' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <Link href={item.pageLink} className="block cursor-pointer">
                      <span className="font-medium text-gray-900">{item.companyName}</span>
                      <span className="block text-xs text-gray-600">{scheduledStr}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        removeRecall(item.id)
                      }}
                      className="mt-1 text-xs text-gray-500 underline hover:text-red-600"
                    >
                      削除
                    </button>
                  </li>
                )
              })
            )
          ) : filteredRows.length === 0 ? (
            <li className="px-3 py-4 text-center text-xs text-gray-500">
              {loading ? '読み込み中…' : '表示する行がありません'}
            </li>
          ) : (
            filteredRows.map((item) => {
              const isActive = pathname === SALES_ROOM_V2_BASE && activeListItemId === item.id
              return (
                <li key={item.id} className="border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => openCompanyFromRow(item)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50/80 ${
                      isActive ? 'bg-blue-100/90' : 'bg-white'
                    }`}
                  >
                    <span className="font-medium text-gray-900">{item.companyName}</span>
                    <span className="block font-mono text-xs text-gray-600">{item.phone ?? '—'}</span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </aside>
  )
}
