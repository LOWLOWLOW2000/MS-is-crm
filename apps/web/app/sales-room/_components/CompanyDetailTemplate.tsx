'use client'

import type React from 'react'
import { SalesRoomActionResultPanel } from './SalesRoomActionResultPanel'

const SAMPLE_PHONE_LIST = [
  { label: 'ブランチ丸の内', phone: '03-1234-5001' },
  { label: '本社・本部・本店', phone: '03-1234-5000' },
  { label: '営業本部直通', phone: '03-1234-5002' },
  { label: '情報システム部直通', phone: '03-1234-5003' },
]

const SAMPLE_PERSONAS = [
  {
    id: 'p_001',
    department: '営業本部',
    name: '山田 太郎',
    phone: '03-1234-5678',
    email: 'yamada@example.co.jp',
  },
  {
    id: 'p_002',
    department: '情報システム部',
    name: '佐藤 花子',
    phone: '03-1234-5679',
    email: 'sato@example.co.jp',
  },
]

export interface CompanyDetailTemplateProps {
  /** 互換性維持用。今回の実装では内部で固定レイアウトにするため未使用 */
  centerPanel?: React.ReactNode
}

export const CompanyDetailTemplate: React.FC<CompanyDetailTemplateProps> = () => {
  return (
    <div className="rounded-md border border-gray-200 bg-white shadow-sm">
      {/* ヘッダ：詳細表示（リスト名）＋ リスト変更 UI */}
      <header className="flex flex-col items-start justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-col text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900">詳細表示（再架電リスト）</span>
            <span className="text-gray-500">リスト選択（リスト・過去架電・資料送付・過去アポ）</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] text-gray-600">リスト変更→</span>
          <select className="rounded border border-gray-300 bg-white px-3 py-1.5 text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option>再架電</option>
            <option>履歴</option>
            <option>AIリスト</option>
          </select>
          <button
            type="button"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-600 hover:border-gray-400 hover:bg-gray-50"
          >
            一覧
          </button>
          <button
            type="button"
            className="rounded border border-indigo-500 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
          >
            修正や担当名など追加
          </button>
        </div>
      </header>

      {/* メイン：左＝詳細表示＋行動結果・メモ / 右＝トークスクリプト（7:3 レイアウト） */}
      <div className="flex min-h-0 flex-col gap-2 px-3 py-2 sm:flex-row sm:gap-3">
        {/* 左 7 */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 sm:basis-2/3 sm:max-w-[70%]">
          {/* 詳細表示（※※※）エリア（サンプル） */}
          <section className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 shadow-sm">
            <div className="flex flex-col gap-1.5 text-xs">
              <div>
                <span className="font-medium text-gray-500">架電ID</span>
                <span className="ml-1.5 font-mono font-medium text-gray-900">crec_001</span>
              </div>
              <div className="text-sm font-semibold text-gray-900">
                商号（支店など）
                <span className="ml-1">株式会社サンプル企業「本社」</span>
              </div>
              <div className="text-xs">
                <span className="font-medium text-gray-500">支店・施設 所在地</span>
                <span className="ml-1 text-gray-900">東京都千代田区丸の内1-1-1</span>
              </div>
            </div>
          </section>

          {/* 電話一覧（押下で発信）＋ 担当者（TEL / MAIL） */}
          <section className="w-full space-y-2">
            <div className="flex w-full flex-wrap items-center gap-1.5 text-sm font-semibold">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-800">
                電話一覧（押下で発信）
              </span>
              {SAMPLE_PHONE_LIST.map((item) => (
                <a
                  key={item.label}
                  href={`tel:${item.phone.replace(/-/g, '')}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-800 hover:bg-sky-100"
                  title={`${item.label}に発信`}
                  aria-label={`${item.label}に発信`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V21a2 2 0 01-2 2h-1C9.716 23 3 16.284 3 8V5z"
                    />
                  </svg>
                  <span>{item.label}</span>
                  <span className="font-mono">{item.phone}</span>
                </a>
              ))}
            </div>

            <div className="flex w-full flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-800">
                担当者（TEL / MAIL）
              </span>
              {SAMPLE_PERSONAS.map((p) => (
                <div
                  key={p.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900"
                >
                  <span className="text-emerald-700">{p.department}</span>
                  <span className="font-semibold text-emerald-950">{p.name}</span>
                  <a
                    href={`tel:${p.phone.replace(/-/g, '')}`}
                    className="inline-flex items-center gap-0.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-700"
                    title={`${p.name} に電話`}
                    aria-label={`${p.name} に電話`}
                  >
                    TEL
                  </a>
                  <a
                    href={`mailto:${p.email}`}
                    className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-200"
                    title={`${p.name} にメール`}
                    aria-label={`${p.name} にメール`}
                  >
                    MAIL
                  </a>
                </div>
              ))}
            </div>
          </section>

          {/* 行動結果・メモ（左メイン内） */}
          <SalesRoomActionResultPanel />
        </div>

        {/* 右 3：トークスクリプト縦長 */}
        <aside className="min-h-0 shrink-0 rounded-md border border-indigo-100 bg-indigo-50/40 px-3 py-2 text-[11px] text-gray-800 sm:basis-1/3 sm:max-w-[30%]">
          <div className="mb-1 flex items-center justify-between gap-2 border-b border-indigo-100 pb-1">
            <h3 className="text-xs font-semibold text-indigo-900">トークスクリプト</h3>
            <span className="text-[10px] text-indigo-700">詳細編集は「トーク」タブから</span>
          </div>
          <div className="mt-1 h-full min-h-[160px] rounded border border-indigo-100 bg-white/95 p-2 leading-relaxed">
            <p className="text-gray-600">
              管理職がセットしたトークスクリプトと、自分で書いたトークスクリプトの要約がここに表示されます。
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

