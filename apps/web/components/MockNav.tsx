'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { formatHeaderRolesJa } from '@/lib/role-labels'
import type { UserRole } from '@/lib/types'
import { MOCK_NAV_UNDER_CONSTRUCTION_HREFS } from './mock-nav-config'
import { useMockNavModel } from './use-mock-nav-model'

export type { NavLayer, MockNavItem } from './mock-nav-config'
export { MOCK_NAV_ITEMS } from './mock-nav-config'

/**
 * API コックピット左ナビ先頭ブロック（`nav > div`）と同型。compact 時は架電ルーム右ペイン用の小ヘッダ。
 */
export function MockNavSidebarTop({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname() ?? ''
  const { data: session, status } = useSession()

  const cardPad = compact ? 'px-2 py-1.5 gap-1' : 'px-3 py-2 gap-1.5'
  const labelText = compact ? 'text-[9px]' : 'text-[11px]'
  const valueText = compact ? 'text-[11px]' : 'text-sm'
  const pjBtn = compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-sm'
  const skeletonH = compact ? 'h-14' : 'h-[5.25rem]'

  return (
    <div className={compact ? 'mb-2 space-y-1.5' : 'mb-3 space-y-2'}>
      {status === 'loading' ? (
        <div className={`${skeletonH} w-full animate-pulse rounded-lg bg-gray-100`} aria-hidden />
      ) : session?.user ? (
        <Link
          href="/dashboard"
          className={`flex min-w-0 flex-col justify-center rounded-lg border border-gray-300 bg-white text-left leading-tight hover:bg-gray-50 ${cardPad}`}
          title="ダッシュボードへ"
          role="button"
        >
          <span className={`truncate ${labelText} text-gray-500`}>
            所属企業
            <span className="mx-1 text-gray-300">/</span>
            <span className={`font-semibold text-gray-900 ${valueText}`}>
              {session.user.tenantCompanyName || '未設定'}
            </span>
          </span>
          <span className={`truncate ${labelText} text-gray-500`}>
            PJ名
            <span className="mx-1 text-gray-300">/</span>
            <span className={`font-semibold text-gray-900 ${valueText}`}>
              {session.user.tenantProjectName || '未設定'}
            </span>
          </span>
          <span className={`truncate ${labelText} text-gray-500`}>
            自分名
            <span className="mx-1 text-gray-300">/</span>
            <span className={`font-semibold text-gray-900 ${valueText}`}>{session.user.name}</span>
          </span>
          <span className={`truncate ${labelText} text-gray-500`}>
            役職
            <span className="mx-1 text-gray-300">/</span>
            <span className={`font-semibold text-gray-900 ${valueText}`}>
              {formatHeaderRolesJa((session.user.roles ?? [session.user.role]) as UserRole[])}
            </span>
          </span>
        </Link>
      ) : null}
      <Link
        href="/pj-switch"
        className={`block w-full rounded-lg border border-gray-300 bg-gray-100 text-center font-medium text-gray-800 hover:bg-gray-200 ${pjBtn} ${
          pathname === '/pj-switch' || pathname === '/office' ? 'ring-2 ring-gray-400 ring-offset-1' : ''
        }`}
        role="button"
      >
        PJ変更
      </Link>
    </div>
  )
}

/**
 * 左ナビと同一項目・権限で、折り返し2行想定のミニメニュー（架電ルーム右ペイン用）。
 */
export function MockNavCompactQuickMenu() {
  const { pathname, visibleItemsWithAdminException, directorRequestBadgeCount } = useMockNavModel()

  return (
    <nav className="flex flex-wrap gap-1" aria-label="クイックメニュー">
      {visibleItemsWithAdminException.map(({ label, href, layer }) => {
        const hrefPath = href.split('?')[0]
        const isActive =
          pathname === hrefPath || (hrefPath !== '/dashboard' && pathname.startsWith(hrefPath))
        const base =
          'inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight transition-colors'
        const activeStyle = isActive ? 'ring-1 ring-offset-1' : ''
        const layerStyle =
          layer === 'director'
            ? `border-amber-200 bg-amber-50/90 text-amber-900 hover:bg-amber-100 ${isActive ? 'ring-amber-400' : ''}`
            : layer === 'enterprise'
              ? `border-violet-200 bg-violet-50/90 text-violet-950 hover:bg-violet-100 ${isActive ? 'ring-violet-400' : ''}`
              : `border-blue-200 bg-blue-50/90 text-blue-900 hover:bg-blue-100 ${isActive ? 'ring-blue-400' : ''}`

        return (
          <Link
            key={href}
            href={href}
            className={`${base} ${activeStyle} ${layerStyle}`}
            role="button"
          >
            <span className="min-w-0 truncate">{label}</span>
            {MOCK_NAV_UNDER_CONSTRUCTION_HREFS.has(href) ? (
              <span
                className="shrink-0 rounded border border-amber-300 bg-amber-50 px-0.5 text-[8px] font-semibold text-amber-900"
                title="画面は準備中です"
              >
                工
              </span>
            ) : null}
            {hrefPath === '/director/requests' && directorRequestBadgeCount > 0 ? (
              <span
                className="inline-flex min-w-4 shrink-0 items-center justify-center rounded-full bg-red-600 px-1 py-px text-[9px] font-bold text-white"
                aria-label={`未確認 ${directorRequestBadgeCount} 件`}
              >
                {directorRequestBadgeCount > 99 ? '99+' : directorRequestBadgeCount}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * モックシェル用の左ナビ。内部リンクはボタン要素で表示。
 * インサイドセールス＝青系、管理職＝琥珀系。レイヤー権限で表示を切り替え。
 */
export function MockNav() {
  const { pathname, visibleItemsWithAdminException, directorRequestBadgeCount } = useMockNavModel()

  return (
    <nav className="w-full shrink-0 bg-white p-3" aria-label="メインメニュー">
      <MockNavSidebarTop />
      <ul className="space-y-1.5">
        {visibleItemsWithAdminException.map(({ label, href, layer }) => {
          const hrefPath = href.split('?')[0]
          const isActive =
            pathname === hrefPath || (hrefPath !== '/dashboard' && pathname.startsWith(hrefPath))
          const baseButton =
            'block w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors'
          const activeStyle = isActive ? 'ring-2 ring-offset-1' : ''
          const layerStyle =
            layer === 'director'
              ? `border-amber-200 bg-amber-50/80 text-amber-900 hover:bg-amber-100 ${isActive ? 'ring-amber-400' : ''}`
              : layer === 'enterprise'
                ? `border-violet-200 bg-violet-50/80 text-violet-950 hover:bg-violet-100 ${isActive ? 'ring-violet-400' : ''}`
                : `border-blue-200 bg-blue-50/80 text-blue-900 hover:bg-blue-100 ${isActive ? 'ring-blue-400' : ''}`

          return (
            <li key={href}>
              <Link
                href={href}
                data-nav-href={hrefPath}
                className={`${baseButton} ${activeStyle} ${layerStyle}`}
                role="button"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate">{label}</span>
                    {MOCK_NAV_UNDER_CONSTRUCTION_HREFS.has(href) ? (
                      <span
                        className="shrink-0 rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-900"
                        title="画面は準備中です"
                      >
                        工事中
                      </span>
                    ) : null}
                  </span>
                  {hrefPath === '/director/requests' && directorRequestBadgeCount > 0 ? (
                    <span
                      className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white"
                      aria-label={`未確認 ${directorRequestBadgeCount} 件`}
                      title={`未読: ${directorRequestBadgeCount}件`}
                    >
                      {directorRequestBadgeCount > 99 ? '99+' : directorRequestBadgeCount}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
