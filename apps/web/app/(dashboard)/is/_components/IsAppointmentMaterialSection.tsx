'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchMyAppointmentMaterial,
  fetchMyAppointmentMaterialSummary,
} from '@/lib/calling-api'
import {
  sortAppointmentMaterialRows,
  type SortableAppointmentMaterialKey,
} from '@/lib/sort-appointment-material-rows'
import type { DirectorRequestRow, DirectorRequestType, MyAppointmentMaterialSummary } from '@/lib/types'

type SegmentFilter = 'all' | DirectorRequestType

const formatTypeJa = (t: DirectorRequestType): string => (t === 'appointment' ? 'アポ' : '資料請求')

const formatIso = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export interface IsAppointmentMaterialSectionProps {
  accessToken: string
  /** 老眼向けにセル余白・文字を大きくする */
  readable?: boolean
}

/**
 * IS 向け: 自分が登録したアポ・資料送付の一覧（セグメント・ソート）
 */
export function IsAppointmentMaterialSection({
  accessToken,
  readable = false,
}: IsAppointmentMaterialSectionProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<DirectorRequestRow[]>([])
  const [summary, setSummary] = useState<MyAppointmentMaterialSummary | null>(null)
  const [segment, setSegment] = useState<SegmentFilter>('all')
  const [sortKey, setSortKey] = useState<SortableAppointmentMaterialKey>('resultCapturedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const cell = readable ? 'border-b border-gray-100 px-4 py-3 text-base' : 'border-b border-gray-100 px-4 py-2 text-sm'
  const thBtn = readable
    ? 'font-bold text-gray-800 hover:text-gray-950 text-base'
    : 'font-semibold text-gray-700 hover:text-gray-900 text-sm'

  const refreshData = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const [s, list] = await Promise.all([
        fetchMyAppointmentMaterialSummary(accessToken),
        fetchMyAppointmentMaterial(accessToken),
      ])
      setSummary(s)
      setRows(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : '取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  const filtered = useMemo(
    () => rows.filter((r) => segment === 'all' || r.type === segment),
    [rows, segment],
  )

  const sorted = useMemo(
    () => sortAppointmentMaterialRows(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir],
  )

  const toggleSort = (key: SortableAppointmentMaterialKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'resultCapturedAt' ? 'desc' : 'asc')
    }
  }

  const sortIndicator = (key: SortableAppointmentMaterialKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className={readable ? 'text-xl font-bold text-gray-900' : 'text-lg font-semibold text-gray-900'}>
            アポ・資料（自分）
          </h2>
          <p className={readable ? 'mt-1 text-base text-gray-800' : 'mt-1 text-sm text-gray-600'}>
            あなたが架電ルームから登録した<span className="font-semibold">アポ / 資料送付</span>のみ表示します
          </p>
        </div>
        <div
          className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-0.5"
          role="group"
          aria-label="種別フィルタ"
        >
          {(
            [
              { value: 'all' as const, label: 'すべて' },
              { value: 'appointment' as const, label: 'アポ' },
              { value: 'material' as const, label: '資料請求' },
            ] as const
          ).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSegment(value)}
              className={`rounded-md px-3 py-2 font-semibold transition-colors ${
                readable ? 'text-base' : 'text-xs'
              } ${
                segment === value
                  ? 'bg-white text-blue-900 shadow-sm ring-1 ring-gray-200'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-gray-200 bg-white px-4 py-3 ${
          readable ? 'text-base text-gray-800' : 'text-sm text-gray-700'
        }`}
      >
        <span>
          合計: <span className="font-bold text-gray-900">{summary?.total ?? '—'}</span>
        </span>
        <span className="text-gray-300" aria-hidden>
          |
        </span>
        <span>
          アポ: <span className="font-bold text-green-800">{summary?.appointment ?? '—'}</span>
        </span>
        <span>
          資料請求: <span className="font-bold text-amber-900">{summary?.material ?? '—'}</span>
        </span>
        <span className="text-gray-300" aria-hidden>
          |
        </span>
        <span>
          表示中: <span className="font-bold text-gray-900">{sorted.length}</span>
        </span>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-base text-red-900" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void refreshData()}
              disabled={loading}
              className="rounded border border-red-300 bg-white px-3 py-1 text-sm font-semibold text-red-900 hover:bg-red-50 disabled:opacity-50"
            >
              再読み込み
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="overflow-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead className="bg-gray-50 text-left text-xs font-bold text-gray-700">
              <tr>
                <th className="border-b border-gray-200 px-4 py-2">
                  <button type="button" onClick={() => toggleSort('type')} className={thBtn}>
                    種別{sortIndicator('type')}
                  </button>
                </th>
                <th className="border-b border-gray-200 px-4 py-2">
                  <button type="button" onClick={() => toggleSort('resultCapturedAt')} className={thBtn}>
                    記録日時{sortIndicator('resultCapturedAt')}
                  </button>
                </th>
                <th className="border-b border-gray-200 px-4 py-2">
                  <button type="button" onClick={() => toggleSort('companyName')} className={thBtn}>
                    会社名{sortIndicator('companyName')}
                  </button>
                </th>
                <th className="border-b border-gray-200 px-4 py-2">
                  <button type="button" onClick={() => toggleSort('targetUrl')} className={thBtn}>
                    URL{sortIndicator('targetUrl')}
                  </button>
                </th>
                <th className="border-b border-gray-200 px-4 py-2">
                  <button type="button" onClick={() => toggleSort('memo')} className={thBtn}>
                    メモ{sortIndicator('memo')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-600" colSpan={5}>
                    読み込み中…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-600" colSpan={5}>
                    対象データがありません
                  </td>
                </tr>
              ) : (
                sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className={cell}>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                          r.type === 'appointment'
                            ? 'bg-green-50 text-green-800 ring-1 ring-green-200'
                            : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                        }`}
                      >
                        {formatTypeJa(r.type)}
                      </span>
                    </td>
                    <td className={`${cell} text-gray-800`}>{formatIso(r.resultCapturedAt)}</td>
                    <td className={`${cell} font-semibold text-gray-900`}>{r.companyName}</td>
                    <td className={cell}>
                      <a
                        href={r.targetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-blue-700 underline"
                      >
                        開く
                      </a>
                    </td>
                    <td className={`${cell} text-gray-800`}>{r.memo || '—'}</td>
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
