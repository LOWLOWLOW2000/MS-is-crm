import type { ReactNode } from 'react'

export interface RoleTierPanelProps {
  /** パネル見出し */
  title: string
  /** 右上バッジ（例: Tier / 役職ラベル） */
  badge?: string
  /** 枠の色（Admin 画面の director / IS と同系） */
  ringClass?: string
  /** 説明文 */
  description?: string
  children: ReactNode
}

/**
 * 役職・区分をカード状にまとめる共通パネル（管理画面・企業管理で統一）
 */
export function RoleTierPanel({
  title,
  badge,
  ringClass = 'ring-violet-400/70',
  description,
  children,
}: RoleTierPanelProps) {
  return (
    <section
      className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ring-2 ring-offset-2 ring-offset-white ${ringClass}`}
      aria-labelledby={`panel-${title.replace(/\s+/g, '-')}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3">
        <div>
          <h2 id={`panel-${title.replace(/\s+/g, '-')}`} className="text-sm font-semibold text-gray-900">
            {title}
          </h2>
          {description ? <p className="mt-1 text-xs text-gray-500">{description}</p> : null}
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}
