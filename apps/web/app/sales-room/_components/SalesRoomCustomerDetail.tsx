'use client'

import { useState } from 'react'
import {
  Building,
  User,
  Email,
  Phone,
  Location,
  Calendar,
  Currency,
  Document,
  Chat,
  Edit,
} from '@carbon/icons-react'
import type { Customer } from '../mock-customers'
import { SalesRoomCallingUI } from './SalesRoomCallingUI'

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

const TABS = [
  { id: 'overview', label: '概要' },
  { id: 'activities', label: '活動履歴' },
  { id: 'deals', label: '取引' },
  { id: 'calling', label: '架電' },
] as const

export interface SalesRoomCustomerDetailProps {
  customer: Customer
}

/**
 * 営業ルーム右カラム: 顧客詳細（連絡先カード + タブ: 概要/活動履歴/取引/架電）。
 */
export function SalesRoomCustomerDetail({ customer }: SalesRoomCustomerDetailProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('overview')

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div className="max-w-4xl flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Building size={32} className="text-gray-600" />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{customer.name}</h1>
              <p className="text-sm text-gray-500">{customer.company}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded border px-2 py-1 text-xs ${getStatusStyle(customer.status)}`}
            >
              {getStatusLabel(customer.status)}
            </span>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Edit size={16} />
              編集
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              <User size={20} className="text-gray-500" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500">担当者</p>
                <p className="truncate text-sm font-medium text-gray-800">{customer.contact}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              <Email size={20} className="text-gray-500" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500">メール</p>
                <p className="truncate text-sm font-medium text-gray-800">{customer.email}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              <Phone size={20} className="text-gray-500" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500">電話</p>
                <p className="text-sm font-medium text-gray-800">{customer.phone}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              <Currency size={20} className="text-gray-500" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500">総売上</p>
                <p className="text-sm font-medium text-gray-800">{customer.revenue}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded px-3 py-1.5 text-sm ${
                tab === t.id
                  ? 'bg-gray-200 font-medium text-gray-900'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-4 pt-4">
            <section className="rounded-lg border border-gray-200 p-4">
              <h2 className="mb-3 text-lg font-semibold text-gray-800">基本情報</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Location size={18} className="mt-0.5 shrink-0 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">住所</p>
                    <p className="text-sm text-gray-800">{customer.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User size={18} className="mt-0.5 shrink-0 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">役職</p>
                    <p className="text-sm text-gray-800">{customer.position}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar size={18} className="mt-0.5 shrink-0 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">取引開始日</p>
                    <p className="text-sm text-gray-800">{customer.since}</p>
                  </div>
                </div>
              </div>
            </section>
            <section className="rounded-lg border border-gray-200 p-4">
              <h2 className="mb-3 text-lg font-semibold text-gray-800">メモ</h2>
              <p className="text-sm text-gray-700">{customer.notes}</p>
            </section>
          </div>
        )}

        {tab === 'activities' && (
          <div className="space-y-3 pt-4">
            {customer.activities.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-lg border border-gray-200 p-4"
              >
                <div className="shrink-0">
                  {a.type === 'meeting' && <Chat size={20} className="text-blue-600" />}
                  {a.type === 'email' && <Email size={20} className="text-green-600" />}
                  {a.type === 'call' && <Phone size={20} className="text-amber-600" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800">{a.description}</p>
                  <p className="mt-1 text-xs text-gray-500">{a.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'deals' && (
          <div className="space-y-3 pt-4">
            {customer.deals.length > 0 ? (
              customer.deals.map((d) => (
                <div
                  key={d.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-start gap-3">
                    <Document size={20} className="mt-0.5 shrink-0 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{d.name}</p>
                      <p className="text-xs text-gray-500">{d.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-800">{d.amount}</p>
                    <span
                      className={`mt-1 inline-block rounded border px-2 py-0.5 text-xs ${
                        d.status === '完了'
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : d.status === '進行中'
                          ? 'bg-blue-100 text-blue-800 border-blue-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Document size={48} className="mb-2 opacity-30" />
                <p className="text-sm">取引情報がありません</p>
              </div>
            )}
          </div>
        )}

        {tab === 'calling' && (
          <div className="min-h-[420px] pt-4">
            <SalesRoomCallingUI
              companyName={customer.name}
              companyPhone={customer.phone}
              companyAddress={customer.address}
              targetUrl="https://example.com"
            />
          </div>
        )}
      </div>
    </div>
  )
}
