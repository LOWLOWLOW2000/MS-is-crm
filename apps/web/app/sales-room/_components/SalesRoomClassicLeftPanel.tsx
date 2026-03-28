'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { DEFAULT_HOLD_LIST_ENTRIES, DEFAULT_HOLD_LIST_ID } from '@/lib/hold-list-config'
import { SALES_ROOM_RESULT_OPTIONS } from '@/lib/sales-room-result-options'
import { MOCK_CUSTOMERS, countCallingResultsInMock } from '../mock-customers'
import { SALES_ROOM_V2_BASE } from '@/lib/sales-room-paths'

const CLAIM_ROOM_PATH = '/sales-room/claim-room'

function labelForResultValue(value: string): string {
  const hit = SALES_ROOM_RESULT_OPTIONS.find((o) => o.value === value)
  return hit?.label ?? value
}

/**
 * 従来架電ルーム（/sales-room）左ナビ下: 保有リスト一覧・架電結果サマリ・クレーム対応ルームへの導線。
 */
export function SalesRoomClassicLeftPanel() {
  const searchParams = useSearchParams()
  const rawList = searchParams.get('list') ?? DEFAULT_HOLD_LIST_ID
  const listParam = DEFAULT_HOLD_LIST_ENTRIES.some((e) => e.id === rawList)
    ? rawList
    : DEFAULT_HOLD_LIST_ID

  const countsByHoldId = useMemo(() => {
    const map: Record<string, number> = {}
    DEFAULT_HOLD_LIST_ENTRIES.forEach((e) => {
      map[e.id] = MOCK_CUSTOMERS.filter(
        (c) => c.callingResult != null && e.resultValues.includes(c.callingResult),
      ).length
    })
    return map
  }, [])

  const resultSummary = useMemo(() => countCallingResultsInMock(), [])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto border-t border-gray-200 bg-white p-2 text-[11px]">
      <section aria-labelledby="hold-list-heading">
        <h2 id="hold-list-heading" className="px-1 font-semibold text-gray-800">
          保有リスト一覧
        </h2>
        <p className="mt-0.5 px-1 text-[10px] leading-snug text-gray-500">
          架電結果が付いた案件のみ。次回ACTが近い順に右カラムへ表示。
        </p>
        <ul className="mt-1 space-y-0.5" role="list">
          {DEFAULT_HOLD_LIST_ENTRIES.map((e) => {
            const active = listParam === e.id
            const n = countsByHoldId[e.id] ?? 0
            return (
              <li key={e.id}>
                <Link
                  href={`/sales-room?list=${encodeURIComponent(e.id)}`}
                  className={`block rounded px-2 py-1.5 transition-colors ${
                    active ? 'bg-blue-100 font-semibold text-blue-900' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate">{e.label}</span>
                    <span className="shrink-0 tabular-nums text-gray-500">{n}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="result-summary-heading" className="border-t border-gray-100 pt-2">
        <h2 id="result-summary-heading" className="px-1 font-semibold text-gray-800">
          架電結果リスト（件数）
        </h2>
        <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto rounded border border-gray-100 bg-gray-50/80 p-1.5" role="list">
          {Object.entries(resultSummary)
            .sort(([a], [b]) => a.localeCompare(b, 'ja'))
            .map(([key, n]) => (
              <li key={key} className="flex justify-between gap-2 text-[10px] text-gray-700">
                <span className="min-w-0 truncate" title={key}>
                  {key === '（未設定）' ? key : labelForResultValue(key)}
                </span>
                <span className="shrink-0 tabular-nums text-gray-600">{n}</span>
              </li>
            ))}
        </ul>
      </section>

      <section className="border-t border-gray-100 pt-2">
        <Link
          href={CLAIM_ROOM_PATH}
          className="block w-full rounded border border-amber-300 bg-amber-50 py-2 text-center text-[11px] font-semibold text-amber-950 hover:bg-amber-100"
        >
          クレーム対応架電ルームへ
        </Link>
        <Link
          href={SALES_ROOM_V2_BASE}
          className="mt-1 block w-full rounded border border-gray-200 bg-white py-1.5 text-center text-[10px] font-medium text-gray-700 hover:bg-gray-50"
        >
          API 架電ルーム（/sales-room/v2）を開く
        </Link>
      </section>
    </div>
  )
}
