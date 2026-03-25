'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { fetchMyProfile } from '@/lib/calling-api'
import type { UserRole } from '@/lib/types'

/** レイヤー権限：インサイドセールス / 管理職 / 共通（両方に表示） */
export type NavLayer = 'is' | 'director' | 'common'

export type MockNavItem = {
  label: string
  href: string
  layer: NavLayer
}

/** App Router の実パス（(dashboard) は URL に含まれない。/dashboard はトップのみ） */
export const MOCK_NAV_ITEMS: MockNavItem[] = [
  { label: '★架電ルーム', href: '/sales-room', layer: 'is' },
  { label: 'KPIページ（AI）', href: '/kpi', layer: 'common' },
  { label: '日報（AI）', href: '/ai-daily', layer: 'common' },
  { label: 'タイムカード', href: '/timecard-invoice?tab=timecard', layer: 'common' },
  { label: '請求書・領収書', href: '/timecard-invoice?tab=invoice', layer: 'common' },
  { label: '★プロフィール設定', href: '/profile', layer: 'common' },
  // 「ディレクター（/director）」は要件により抹消（中身も削除する）
  { label: 'プロジェクトKPI', href: '/director/kpi', layer: 'director' },
  { label: 'AIレポート', href: '/director/ai-report', layer: 'director' },
  { label: '日報BOX', href: '/director/daily-box', layer: 'director' },
  { label: '★リスト格納', href: '/director/calling-lists/import', layer: 'director' },
  { label: '★リスト配布・管理', href: '/director/calling-lists/distribute', layer: 'director' },
  { label: '★役職変更・メンバー招待', href: '/admin', layer: 'director' },
  // Teams表は全削除
  { label: '出勤管理表＆報酬計算', href: '/attendance-payroll', layer: 'director' },
]

/** 現在のユーザーのレイヤー権限。Tier2でセッション・ロールに連動させる想定。 */
type ViewerLayer = NavLayer | 'all'

function normalizeUserRoles(user: unknown): UserRole[] {
  const u = user as { role?: UserRole; roles?: UserRole[] } | null | undefined
  if (!u) return []
  if (Array.isArray(u.roles) && u.roles.length > 0) return u.roles
  if (u.role) return [u.role]
  return []
}

/**
 * モックシェル用の左ナビ。内部リンクはボタン要素で表示。
 * インサイドセールス＝青系、管理職＝琥珀系。レイヤー権限で表示を切り替え。
 */
export function MockNav() {
  const pathname = usePathname() ?? ''
  const { data: session, status } = useSession()

  const sessionRoles = status === 'authenticated' ? normalizeUserRoles(session?.user) : []
  const [resolvedRoles, setResolvedRoles] = useState<UserRole[]>([])
  const effectiveRoles = resolvedRoles.length > 0 ? resolvedRoles : sessionRoles

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!session?.accessToken) return
      try {
        const prof = await fetchMyProfile(session.accessToken)
        const allowed = new Set<UserRole>([
          'developer',
          'enterprise_admin',
          'is_admin',
          'director',
          'is_member',
        ])
        const parsed = (prof.roles ?? []).filter((r): r is UserRole => allowed.has(r as UserRole))
        if (!cancelled) setResolvedRoles(parsed)
      } catch {
        // 失敗時は sessionRoles にフォールバック
      }
    }

    void run()
    const onRolesChanged = () => void run()
    if (typeof window !== 'undefined') {
      window.addEventListener('roles:changed', onRolesChanged)
    }
    return () => {
      cancelled = true
      if (typeof window !== 'undefined') {
        window.removeEventListener('roles:changed', onRolesChanged)
      }
    }
  }, [session?.accessToken])

  const hasDirector = effectiveRoles.some((r) => r === 'director' || r === 'developer')
  const hasIs = effectiveRoles.some((r) => r === 'is_member' || r === 'is_admin')
  const hasEnterpriseAdmin = effectiveRoles.some((r) => r === 'enterprise_admin')

  // 企業アカウント管理者（enterprise_admin）はデフォルトでIS側に倒し、例外として /admin だけ常時表示する
  const viewerLayer: ViewerLayer = hasDirector ? 'director' : hasIs ? 'is' : hasEnterpriseAdmin ? 'is' : 'all'

  const visibleItems =
    viewerLayer === 'all' || viewerLayer === 'director'
      ? MOCK_NAV_ITEMS
      : MOCK_NAV_ITEMS.filter((item) => item.layer !== 'director')

  // 並び順は常に MOCK_NAV_ITEMS の順番を維持し、表示可否だけ切り替える
  const visibleHrefPaths = new Set<string>(
    visibleItems.map((item) => item.href.split('?')[0]),
  )
  if (hasEnterpriseAdmin) visibleHrefPaths.add('/admin')

  const visibleItemsWithAdminException = MOCK_NAV_ITEMS.filter((item) =>
    visibleHrefPaths.has(item.href.split('?')[0]),
  )

  return (
    <nav className="w-full shrink-0 bg-white p-3" aria-label="メインメニュー">
      <div className="mb-3">
        <Link
          href="/pj-switch"
          className={`block w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-center text-sm font-medium text-gray-800 hover:bg-gray-200 ${
            pathname === '/pj-switch' || pathname === '/office' ? 'ring-2 ring-gray-400 ring-offset-1' : ''
          }`}
          role="button"
        >
          PJ変更
        </Link>
      </div>
      <ul className="space-y-1.5">
        {visibleItemsWithAdminException.map(({ label, href, layer }) => {
          const hrefPath = href.split('?')[0]
          const isActive =
            pathname === hrefPath || (hrefPath !== '/dashboard' && pathname.startsWith(hrefPath))
          const isDirectorLayer = layer === 'director'
          const baseButton =
            'block w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors'
          const activeStyle = isActive ? 'ring-2 ring-offset-1' : ''
          const layerStyle = isDirectorLayer
            ? `border-amber-200 bg-amber-50/80 text-amber-900 hover:bg-amber-100 ${isActive ? 'ring-amber-400' : ''}`
            : `border-blue-200 bg-blue-50/80 text-blue-900 hover:bg-blue-100 ${isActive ? 'ring-blue-400' : ''}`

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
