'use client'

import { useState } from 'react'

const KPI_SCOPE_OPTIONS = [
  { value: 'personal', label: '個人' },
  { value: 'team', label: 'チーム' },
  { value: 'pj', label: 'PJ' },
] as const

export interface DailyKpiSectionProps {
  /** true でヘッダー埋め込み用の一列コンパクト表示（余白・下段なし） */
  inline?: boolean
}

/**
 * 当日KPI。個人・チーム・PJの切り替え。
 * inline=true でヘッダー一行に埋め込む用。無料時は親で広告オーバーレイ＋×を被せる想定。
 */
export function DailyKpiSection({ inline = false }: DailyKpiSectionProps) {
  const [scope, setScope] = useState<(typeof KPI_SCOPE_OPTIONS)[number]['value']>('personal')

  const content = (
    <div className="flex items-center gap-2" role="tablist" aria-label="当日KPI（個人・チーム・PJ切り替え）">
      <span className="shrink-0 text-xs font-medium text-gray-500">当日KPI</span>
      <div className="flex rounded-md border border-gray-200 bg-gray-50 p-0.5">
        {KPI_SCOPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={scope === opt.value}
            onClick={() => setScope(opt.value)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              scope === opt.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <span className="hidden text-xs text-gray-400 sm:inline">（個人・チーム・PJ切り替え）</span>
    </div>
  )

  if (inline) {
    return <div className="min-w-0 flex-1">{content}</div>
  }

  return (
    <section className="shrink-0 border-b border-gray-200 bg-white px-4 py-3" aria-label="当日KPI">
      {content}
      <div className="mt-2 min-h-[2.5rem] text-sm text-gray-700">
        {scope === 'personal' && <p>個人KPI: 本日の架電数・成約数など</p>}
        {scope === 'team' && <p>チームKPI: チーム全体の達成状況</p>}
        {scope === 'pj' && <p>PJ KPI: プロジェクト単位の進捗</p>}
      </div>
    </section>
  )
}
