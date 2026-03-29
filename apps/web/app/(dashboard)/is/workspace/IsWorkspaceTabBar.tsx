'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/is/workspace/talk-scripts', label: 'トークスクリプト' },
  { href: '/is/workspace/follow-ups', label: 'フォローアップ' },
  { href: '/is/workspace/lists', label: 'リスト' },
] as const

/**
 * IS ワークスペース内の大きめタブ（視認性・タッチターゲット優先）
 */
export function IsWorkspaceTabBar() {
  const pathname = usePathname()
  return (
    <nav
      className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-4"
      aria-label="ISワークスペース"
    >
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex min-h-[48px] items-center rounded-lg border-2 px-4 py-2 text-lg font-semibold transition-colors ${
              active
                ? 'border-blue-600 bg-blue-50 text-blue-950'
                : 'border-transparent bg-gray-100 text-gray-900 hover:border-gray-300'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
