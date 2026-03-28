'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CompanyDetailTemplate } from './CompanyDetailTemplate'
import { SalesRoomCustomerList } from './SalesRoomCustomerList'
import type { Customer } from '../mock-customers'
import { MOCK_CUSTOMERS } from '../mock-customers'
import {
  DEFAULT_HOLD_LIST_ENTRIES,
  DEFAULT_HOLD_LIST_ID,
  compareByNextActAt,
} from '@/lib/hold-list-config'

/**
 * 従来の架電ルーム: 横2カラム比率 2:8（リスト / CompanyDetailTemplate）。
 * 親 layout（SalesRoomProviders）で CallSessionProvider が供給されること。
 * `?list=` は保有リスト（架電結果）と同期。
 */
export function SalesRoomClassicContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawList = searchParams.get('list') ?? DEFAULT_HOLD_LIST_ID
  const selectedListId = DEFAULT_HOLD_LIST_ENTRIES.some((e) => e.id === rawList)
    ? rawList
    : DEFAULT_HOLD_LIST_ID

  const activeEntry = useMemo(
    () =>
      DEFAULT_HOLD_LIST_ENTRIES.find((e) => e.id === selectedListId) ?? DEFAULT_HOLD_LIST_ENTRIES[0],
    [selectedListId],
  )

  const setSelectedListId = useCallback(
    (listId: string) => {
      router.replace(`/sales-room?list=${encodeURIComponent(listId)}`, { scroll: false })
    },
    [router],
  )

  const filtered = useMemo(() => {
    if (!activeEntry) return []
    const { resultValues } = activeEntry
    return MOCK_CUSTOMERS.filter(
      (c) => c.callingResult != null && resultValues.includes(c.callingResult),
    ).sort(compareByNextActAt)
  }, [activeEntry])

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

  const selectedCustomer = useMemo(
    () => filtered.find((c) => c.id === selectedCustomerId) ?? null,
    [filtered, selectedCustomerId],
  )

  const selectCustomer = useCallback((c: Customer | null) => {
    setSelectedCustomerId(c?.id ?? null)
  }, [])

  const goPrev = useCallback(() => {
    if (!selectedCustomerId || filtered.length === 0) return
    const idx = filtered.findIndex((c) => c.id === selectedCustomerId)
    if (idx <= 0) return
    setSelectedCustomerId(filtered[idx - 1].id)
  }, [filtered, selectedCustomerId])

  const goNext = useCallback(() => {
    if (!selectedCustomerId || filtered.length === 0) return
    const idx = filtered.findIndex((c) => c.id === selectedCustomerId)
    if (idx < 0 || idx >= filtered.length - 1) return
    setSelectedCustomerId(filtered[idx + 1].id)
  }, [filtered, selectedCustomerId])

  return (
    <div className="flex min-h-0 flex-1 flex-col p-2">
      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden rounded-md border border-gray-200 bg-gray-100">
        <div className="flex min-h-0 min-w-0 flex-[2] basis-0 flex-col border-r border-gray-200 bg-white">
          <SalesRoomCustomerList
            selectedListId={selectedListId}
            selectedCustomerId={selectedCustomerId}
            activeHoldLabel={activeEntry?.label ?? ''}
            onSelectList={setSelectedListId}
            onSelectCustomer={selectCustomer}
            onPrev={goPrev}
            onNext={goNext}
            customers={filtered}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-[8] basis-0 flex-col bg-white">
          {selectedCustomer ? (
            <div className="min-h-0 flex-1 overflow-auto p-2">
              <CompanyDetailTemplate
                legalEntityId={selectedCustomer.legalEntityId ?? ''}
                listItemId={selectedCustomer.listItemId ?? ''}
              />
            </div>
          ) : (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 p-6 text-center text-sm text-gray-500">
              <p>左のリストから顧客を選択するとコックピット（/sales-room/v2 相当）が表示されます。</p>
              <p className="text-xs text-gray-400">
                モックに listItemId / legalEntityId が無い場合はサンプル表示です。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
