'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronUp, ChevronDown, User, Email, Phone, PhoneFilled, VolumeMute, Settings } from '@carbon/icons-react'
import type { Customer, ListCollection } from '../mock-customers'
import { MOCK_LIST_COLLECTIONS, MOCK_CUSTOMERS } from '../mock-customers'

function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'pending':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'inactive':
      return 'bg-gray-100 text-gray-600 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'active':
      return 'アクティブ'
    case 'pending':
      return '保留中'
    case 'inactive':
      return '非アクティブ'
    default:
      return status
  }
}

export interface SalesRoomCustomerListProps {
  selectedListId: string
  selectedCustomerId: string | null
  onSelectList: (listId: string) => void
  onSelectCustomer: (customer: Customer | null) => void
  onPrev: () => void
  onNext: () => void
}

/** 電話機能ボタン共通スタイル（横2倍: h-8 w-16） */
const PHONE_BUTTON_CLASS =
  'flex h-8 w-16 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'

/**
 * 営業ルーム左カラム: 電話機能（時間カウンター → 発着信 → ミュート → 設定 → ページ送り）＋ リスト一覧。
 */
export function SalesRoomCustomerList({
  selectedListId,
  selectedCustomerId,
  onSelectList,
  onSelectCustomer,
  onPrev,
  onNext,
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

  const filtered = MOCK_CUSTOMERS.filter((c) => c.lists.includes(selectedListId))
  const selectedList = MOCK_LIST_COLLECTIONS.find((l) => l.id === selectedListId)

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
            disabled={filtered.length === 0 || !selectedCustomerId}
            className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="前へ"
          >
            <ChevronUp size={18} />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={filtered.length === 0 || !selectedCustomerId}
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
        >
          {MOCK_LIST_COLLECTIONS.map((list: ListCollection) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
        {selectedList && (
          <p className="text-xs text-gray-500">{filtered.length}件の顧客</p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length > 0 ? (
          filtered.map((customer) => (
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
                  <p className="text-xs text-gray-500">{customer.contact}</p>
                </div>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-xs ${getStatusStyle(customer.status)}`}
                >
                  {getStatusLabel(customer.status)}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Email size={12} />
                  <span className="truncate">{customer.email}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Phone size={12} />
                  <span>{customer.phone}</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">最終連絡: {customer.lastContact}</p>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <User size={48} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">このリストに顧客がいません</p>
          </div>
        )}
      </div>
    </div>
  )
}
