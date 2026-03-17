'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** レイヤー権限：インサイドセールス / 管理職 / 共通（両方に表示） */
export type NavLayer = 'is' | 'director' | 'common'

export type MockNavItem = {
  label: string
  href: string
  layer: NavLayer
}

export const MOCK_NAV_ITEMS: MockNavItem[] = [
  { label: 'KPIページ（AI診断）', href: '/dashboard/kpi', layer: 'common' },
  { label: 'AI日報', href: '/dashboard/ai-daily', layer: 'common' },
  { label: 'MYデスク', href: '/sales-room', layer: 'is' },
  { label: 'タイムカード＆請求書・領収書', href: '/dashboard/timecard-invoice', layer: 'common' },
  { label: 'ディレクター', href: '/dashboard/director', layer: 'director' },
  { label: 'プロジェクトKPI', href: '/dashboard/director/kpi', layer: 'director' },
  { label: 'AIレポート', href: '/dashboard/director/ai-report', layer: 'director' },
  { label: '日報BOX', href: '/dashboard/director/daily-box', layer: 'director' },
  { label: '管理レイヤ', href: '/dashboard/admin', layer: 'director' },
  { label: 'Teams表', href: '/dashboard/teams', layer: 'director' },
  { label: '出勤管理表＆報酬計算', href: '/dashboard/attendance-payroll', layer: 'director' },
]

/** 現在のユーザーのレイヤー権限。Tier2でセッション・ロールに連動させる想定。 */
const CURRENT_USER_LAYER: NavLayer | 'all' = 'all'

function canSeeItem(itemLayer: NavLayer): boolean {
  if (CURRENT_USER_LAYER === 'all') return true
  if (itemLayer === 'common') return true
  return itemLayer === CURRENT_USER_LAYER
}

/**
 * モックシェル用の左ナビ。内部リンクはボタン要素で表示。
 * インサイドセールス＝青系、管理職＝琥珀系。レイヤー権限で表示を切り替え。
 */
export function MockNav() {
  const pathname = usePathname() ?? ''
  const visibleItems = MOCK_NAV_ITEMS.filter(canSeeItem)

  return (
    <nav className="w-full shrink-0 bg-white p-3" aria-label="メインメニュー">
      <div className="mb-3">
        <Link
          href="/office"
          className="block w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-center text-sm font-medium text-gray-800 hover:bg-gray-200"
          role="button"
        >
          Office共用部
        </Link>
      </div>
      <ul className="space-y-1.5">
        {visibleItems.map(({ label, href, layer }) => {
          const isActive =
            pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          const isIS = layer === 'is'
          const isDirector = layer === 'director'
          const baseButton =
            'block w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors'
          const activeStyle = isActive ? 'ring-2 ring-offset-1' : ''
          const layerStyle = isIS
            ? `border-blue-200 bg-blue-50/80 text-blue-900 hover:bg-blue-100 ${isActive ? 'ring-blue-400' : ''}`
            : isDirector
              ? `border-amber-200 bg-amber-50/80 text-amber-900 hover:bg-amber-100 ${isActive ? 'ring-amber-400' : ''}`
              : `border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100 ${isActive ? 'ring-gray-400' : ''}`

          return (
            <li key={href}>
              <Link
                href={href}
                className={`${baseButton} ${activeStyle} ${layerStyle}`}
                role="button"
              >
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
