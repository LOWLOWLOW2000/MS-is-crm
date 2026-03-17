'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRecallListStore } from '@/lib/stores/recall-list-store'

const LIST_OPTIONS: { value: string; label: string }[] = [
  { value: 'list', label: 'リスト' },
  { value: 'ai', label: 'AIリスト' },
  { value: 'history', label: '架電履歴' },
  { value: 'reserve', label: '予約架電' },
]

const MOCK_LIST_ITEMS = [
  { id: 1, title: 'List item', sub: 'Secondary' },
  { id: 2, title: 'サンプル企業A', sub: '東京都' },
  { id: 3, title: 'サンプル企業B', sub: '大阪府' },
  { id: 4, title: 'List item', sub: 'Secondary' },
  { id: 5, title: 'テスト株式会社', sub: '福岡県' },
]

const FLASH_NEAR_MS = 3 * 60 * 1000

/**
 * 営業ルーム左パネル。リスト機能（プルダウン＋検索）・検索結果一覧。予約架電は架電リスト表示・時間近づくと黄色点滅・直リンク。
 */
const RECALL_LIST_PAGE_SIZE = 10

export function SalesRoomLeftPanel() {
  const [listType, setListType] = useState('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [recallPage, setRecallPage] = useState(0)
  const recallItems = useRecallListStore((s) => s.items)
  const removeRecall = useRecallListStore((s) => s.remove)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setRecallPage(0)
  }, [listType])

  useEffect(() => {
    if (recallItems.length > 0 && recallPage >= recallTotalPages) setRecallPage(recallTotalPages - 1)
  }, [recallItems.length, recallPage, recallTotalPages])

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_LIST_ITEMS
    const q = searchQuery.trim().toLowerCase()
    return MOCK_LIST_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) || item.sub.toLowerCase().includes(q)
    )
  }, [searchQuery])

  const recallTotalPages = Math.max(1, Math.ceil(recallItems.length / RECALL_LIST_PAGE_SIZE))
  const recallPageItems = useMemo(
    () =>
      recallItems.slice(
        recallPage * RECALL_LIST_PAGE_SIZE,
        (recallPage + 1) * RECALL_LIST_PAGE_SIZE
      ),
    [recallItems, recallPage]
  )

  return (
    <aside
      className="flex min-h-0 flex-1 flex-col bg-white animate-slideInLeft"
      aria-label="リスト一覧"
    >
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <div className="shrink-0 border-b border-gray-200 bg-gray-50 p-2 space-y-2">
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
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="検索..."
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="リスト検索"
          />
          <p className="text-[10px] text-gray-400" aria-hidden>
            部分一致検索・ID検索
          </p>
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
          ) : filteredItems.length === 0 ? (
            <li className="px-3 py-4 text-center text-xs text-gray-500">
              検索結果はありません
            </li>
          ) : (
            filteredItems.map((item) => (
              <li
                key={item.id}
                className="cursor-pointer border-b border-gray-100 px-3 py-2 text-sm hover:bg-gray-50"
              >
                {item.title}
                <span className="block text-xs text-gray-500">{item.sub}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </aside>
  )
}
