'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import type { UserRole } from '@/lib/types'

/** docs/role-tier-matrix.md の TIER 1・2 のみ表示するロール */
const TIER_1_OR_2_ROLES: UserRole[] = ['developer', 'enterprise_admin', 'is_admin', 'director']

/**
 * メニュー用内部リンク。権限対照表に従い TIER 1・2 のみ表示の項目をロールで出し分けする。
 */
export function DashboardMenuLinks() {
  const { data: session, status } = useSession()
  const role = (status === 'authenticated' && session?.user?.role
    ? session.user.role
    : null) as UserRole | null
  const canSeeTier1Or2 = role !== null && TIER_1_OR_2_ROLES.includes(role)

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <section>
        <h2 className="text-sm font-semibold text-gray-700">共通・IS向け</h2>
        <ul className="mt-2 space-y-2">
          <li>
            <Link href="/dashboard/calendar" className="text-blue-600 hover:underline">
              カレンダー（schedule）
            </Link>
            <span className="ml-1 text-xs text-gray-500">当月の総稼働時間/予定時間・タイムカード</span>
          </li>
          <li>
            <Link href="/dashboard?view=corporate" className="text-blue-600 hover:underline">
              個人アカウントページ
            </Link>
          </li>
          <li>
            <Link href="/dashboard?view=kpi" className="text-blue-600 hover:underline">
              KPIページ（AI）
            </Link>
          </li>
          <li>
            <Link href="/dashboard?view=ai-daily" className="text-blue-600 hover:underline">
              日報（AI）
            </Link>
          </li>
          {canSeeTier1Or2 && (
            <li>
              <Link href="/role-transfer" className="text-blue-600 hover:underline">
                権限委任ページ
              </Link>
            </li>
          )}
          <li>
            <Link href="/sales-room" className="text-blue-600 hover:underline">
              架電ルーム
            </Link>
          </li>
          {canSeeTier1Or2 && (
            <li>
              <Link href="/list-distribution" className="text-blue-600 hover:underline">
                リスト配布
              </Link>
            </li>
          )}
        </ul>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-gray-700">ディレクター・企業アカウント専用</h2>
        <ul className="mt-2 space-y-2">
          {canSeeTier1Or2 && (
            <>
              <li>
                <Link href="/dashboard?view=corporate" className="text-blue-600 hover:underline">
                  企業管理者
                </Link>
              </li>
              <li>
                <Link href="/dashboard?view=director" className="text-blue-600 hover:underline">
                  ディレクター
                </Link>
              </li>
              <li>
                <Link href="/dashboard?view=director-kpi" className="text-blue-600 hover:underline">
                  プロジェクトKPI
                </Link>
              </li>
              <li>
                <Link href="/dashboard?view=director-ai-report" className="text-blue-600 hover:underline">
                  AIレポート
                </Link>
              </li>
              <li>
                <Link href="/dashboard?view=director-daily-box" className="text-blue-600 hover:underline">
                  日報BOX（未読数）
                </Link>
              </li>
            </>
          )}
          {!canSeeTier1Or2 && (
            <li className="text-sm text-gray-500">ディレクター・企業管理者権限で表示されます。</li>
          )}
        </ul>
        <h2 className="mt-4 text-sm font-semibold text-gray-700">その他</h2>
        <ul className="mt-2 space-y-2">
          <li>
            <span className="text-gray-500">社内報</span>
            <span className="ml-1 text-xs text-gray-400">（予定）</span>
          </li>
        </ul>
      </section>
    </div>
  )
}
