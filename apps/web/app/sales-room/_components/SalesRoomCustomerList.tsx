'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { ChevronUp, ChevronDown, User, PhoneFilled, VolumeMute, Settings } from '@carbon/icons-react'
import type { Customer, ListCollection } from '../mock-customers'
import { MOCK_LIST_COLLECTIONS } from '../mock-customers'
import { callingResultCompactBadgeClasses } from '@/lib/sales-room-calling-result-ui'
import { SALES_ROOM_RESULT_OPTIONS } from '@/lib/sales-room-result-options'

function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * 住所から都道府県＋市区町村（区含む）までを返す簡易抽出
 */
function addressToCityLevel(address: string): string {
  const s = address.trim()
  if (!s) return '—'
  const pref = s.match(/^(.{2,12}[都道府県])/)
  if (!pref) return s.length > 28 ? `${s.slice(0, 25)}…` : s
  const rest = s.slice(pref[1].length)
  const ward = rest.match(/^(.+?区)/)
  if (ward) return `${pref[1]}${ward[1]}`
  const city = rest.match(/^(.+?[市县町村])/)
  if (city) return `${pref[1]}${city[1]}`
  return pref[1]
}

function resultLabelForCustomer(c: Customer): string {
  const v = c.callingResult
  if (!v) return '—'
  const hit = SALES_ROOM_RESULT_OPTIONS.find((o) => o.value === v)
  return hit?.label ?? v
}

/** 一覧右バッジ: 未架電 or 行動結果（架電結果ラベル） */
function latestStatusText(c: Customer): string {
  if (!c.callingResult) return '未架電'
  return resultLabelForCustomer(c)
}

export interface SalesRoomCustomerListProps {
  selectedListId: string
  selectedCustomerId: string | null
  /** 現在の保有リスト表示名（説明文用） */
  activeHoldLabel: string
  onSelectList: (listId: string) => void
  onSelectCustomer: (customer: Customer | null) => void
  onPrev: () => void
  onNext: () => void
  /** 保有リストに応じた顧客（架電結果一致・次回ACT順は親でソート済み） */
  customers: Customer[]
}

/** 電話機能ボタン共通スタイル（横2倍: h-8 w-16） */
const PHONE_BUTTON_CLASS =
  'flex h-8 w-16 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'

/**
 * 営業ルーム左カラム: 電話機能（時間カウンター → 発着信 → ミュート → 設定 → ページ送り）＋ 保有リスト（架電結果）一覧。
 */
export function SalesRoomCustomerList({
  selectedListId,
  selectedCustomerId,
  activeHoldLabel,
  onSelectList,
  onSelectCustomer,
  onPrev,
  onNext,
  customers,
}: SalesRoomCustomerListProps) {
  const [isCallActive, setIsCallActive] = useState(false)
  const [callDurationSeconds, setCallDurationSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isCallActive) return
    timerRef.current = setInterval(() => {
      setCallDurationSeconds((s) => s + 1)
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [isCallActive])

  const handlePhoneClick = () => {
    if (isCallActive) {
      setIsCallActive(false)
      setCallDurationSeconds(0)
    } else {
      setIsCallActive(true)
      setCallDurationSeconds(0)
    }
  }

  const selectedList = useMemo(
    () => MOCK_LIST_COLLECTIONS.find((l) => l.id === selectedListId),
    [selectedListId],
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 border-b border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          {/* 1. 時間カウンター */}
          <span
            className="min-w-[3.5rem] font-mono text-sm font-medium tabular-nums text-gray-700"
            aria-label="通話時間"
          >
            {formatCallDuration(callDurationSeconds)}
          </span>
          {/* 2. 発着信 */}
          <button
            type="button"
            onClick={handlePhoneClick}
            className={`${PHONE_BUTTON_CLASS} ${isCallActive ? 'border-red-300 bg-red-50 text-red-700' : ''}`}
            title={isCallActive ? '切る' : '発着信'}
            aria-label={isCallActive ? '切る' : '発着信'}
          >
            <PhoneFilled size={20} />
          </button>
          {/* 3. ミュート */}
          <button
            type="button"
            className={PHONE_BUTTON_CLASS}
            title="ミュート"
            aria-label="ミュート"
          >
            <VolumeMute size={20} />
          </button>
          {/* 4. 設定 */}
          <button
            type="button"
            className={PHONE_BUTTON_CLASS}
            title="設定"
            aria-label="設定"
          >
            <Settings size={20} />
          </button>
          {/* 5. ページ送り */}
          <button
            type="button"
            onClick={onPrev}
            disabled={customers.length === 0 || !selectedCustomerId}
            className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="前へ"
          >
            <ChevronUp size={18} />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={customers.length === 0 || !selectedCustomerId}
            className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="次へ"
          >
            <ChevronDown size={18} />
          </button>
        </div>
        <select
          value={selectedListId}
          onChange={(e) => onSelectList(e.target.value)}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          aria-label="保有リスト（架電結果）"
        >
          {MOCK_LIST_COLLECTIONS.map((list: ListCollection) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
        {selectedList && (
          <p className="text-xs text-gray-500">
            「{activeHoldLabel}」: {customers.length}件（次回ACTが近い順）
          </p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {customers.length > 0 ? (
          customers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => onSelectCustomer(customer)}
              className={`w-full border-b border-gray-100 p-4 text-left transition-colors hover:bg-white ${
                selectedCustomerId === customer.id
                  ? 'border-l-4 border-l-blue-500 bg-white'
                  : 'bg-gray-50'
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{customer.name}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{addressToCityLevel(customer.address)}</p>
                </div>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-xs ${callingResultCompactBadgeClasses(customer.callingResult)}`}
                >
                  {latestStatusText(customer)}
                </span>
              </div>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <User size={48} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">この架電結果の保有案件はありません</p>
            <p className="mt-1 text-xs text-gray-400">架電結果が付いた案件から一覧に入ります。</p>
          </div>
        )}
      </div>
    </div>
  )
}
