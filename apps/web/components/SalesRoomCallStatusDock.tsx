'use client'

import { useState } from 'react'

/**
 * 営業ルーム用：左メニューの一番下に格納する「架電ステータス」ドック（モック）。
 * CompanyDetailTemplate 右端カラムの要素をほぼそのまま移植。
 */
export const SalesRoomCallStatusDock = () => {
  // TODO: 実装時はグローバルな通話ステートと連携
  const [isCallActive] = useState(false)
  const [callTargetName] = useState('株式会社サンプル企業')

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-gray-200 bg-slate-50/90">
      <div className="flex min-h-0 flex-[2] flex-col overflow-hidden border-b border-slate-200 px-2 py-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          架電ステータス
        </p>
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto text-xs text-slate-700">
          <div>
            <span className="text-slate-500">状況：</span>
            <span className={isCallActive ? 'font-medium text-green-700' : 'text-slate-600'}>
              {isCallActive ? '電話中' : '待機中'}
            </span>
          </div>
          {isCallActive && (
            <>
              <div>
                <span className="text-slate-500">かけ先：</span>
                <span className="truncate font-medium text-slate-800">{callTargetName}</span>
              </div>
              <div>
                <span className="text-slate-500">通話時間：</span>
                <span className="font-mono text-slate-800">00:00</span>
              </div>
            </>
          )}
          {!isCallActive && (
            <div>
              <span className="text-slate-500">発信先：</span>
              <span className="truncate text-slate-600">{callTargetName}</span>
            </div>
          )}
        </div>
      </div>

      {/* パット呼出・終話 */}
      <button
        type="button"
        title="パット呼出・終話"
        className="flex flex-1 items-center justify-center border-0 border-t border-slate-300 bg-slate-200/80 p-0 text-slate-700 hover:bg-green-100 hover:text-green-800"
        aria-label="パット呼出・終話"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V21a2 2 0 01-2 2h-1C9.716 23 3 16.284 3 8V5z"
          />
        </svg>
      </button>

      {/* 保留 */}
      <button
        type="button"
        title="保留"
        className="flex flex-1 items-center justify-center border-0 border-t border-slate-300 bg-slate-200/80 p-0 text-slate-700 hover:bg-amber-100 hover:text-amber-800"
        aria-label="保留"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {/* ヘルプ要請 */}
      <div className="flex flex-1 flex-col items-center justify-center border-0 border-t border-slate-300 bg-slate-200/80">
        <button
          type="button"
          title="ヘルプ要請"
          className="flex flex-1 items-center justify-center px-1 py-0 text-slate-700 hover:bg-slate-300/50 hover:text-slate-800"
          aria-label="ヘルプ要請"
        >
          <span className="text-xs font-medium">ヘルプ要請</span>
        </button>
        <p className="w-full shrink-0 px-0.5 pb-1 text-center text-[11px] leading-tight text-slate-500" aria-hidden>
          ヘルパーの声は相手に聞こえません
        </p>
      </div>
    </div>
  )
}

