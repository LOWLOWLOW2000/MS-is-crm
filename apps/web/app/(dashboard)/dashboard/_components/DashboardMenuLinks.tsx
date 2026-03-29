'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { UserRole } from '@/lib/types'

/** docs/role-tier-matrix.md の TIER 1・2 のみ表示するロール */
const TIER_1_OR_2_ROLES: UserRole[] = ['developer', 'enterprise_admin', 'is_admin', 'director']

const linkClass = 'text-sm text-zinc-700 underline-offset-4 hover:underline'
const linkPrimary = 'text-sm font-medium text-zinc-900 underline-offset-4 hover:underline'

/**
 * Overview 用の全エントリ。実ルートに直リンクし、権限委任・リスト配布などは TIER1/2 のみ表示。
 */
export function DashboardMenuLinks() {
  const { data: session, status } = useSession()
  const role = (status === 'authenticated' && session?.user?.role
    ? session.user.role
    : null) as UserRole | null
  const canSeeTier1Or2 = role !== null && TIER_1_OR_2_ROLES.includes(role)

  return (
    <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-[repeat(2,minmax(280px,1fr))] xl:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">共通・IS</CardTitle>
          <CardDescription>架電・KPI・日報・勤怠</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-none space-y-2">
            <li>
              <Link href="/kpi" className={linkPrimary}>
                KPI（AI）
              </Link>
            </li>
            <li>
              <Link href="/ai-daily" className={linkClass}>
                日報（AI）
              </Link>
            </li>
            <li>
              <Link href="/ai-score" className={linkClass}>
                AIスコアカード
              </Link>
            </li>
            <li>
              <Link href="/sales-room/v2" className={linkClass}>
                架電ルーム ver1（コックピット）
              </Link>
            </li>
            <li>
              <Link href="/sales-room" className={linkClass}>
                架電ルーム ver2（従来）
              </Link>
            </li>
            <li>
              <Link href="/sales-room/refinement" className={linkClass}>
                未調査リスト精査
              </Link>
            </li>
            <li>
              <Link href="/is/workspace" className={linkClass}>
                ISワークスペース（トーク／フォローアップ／リスト）
              </Link>
            </li>
            <li>
              <Link href="/dashboard/calendar" className={linkClass}>
                カレンダー（稼働・予定）
              </Link>
            </li>
            <li>
              <Link href="/timecard-invoice?tab=timecard" className={linkClass}>
                タイムカード
              </Link>
            </li>
            <li>
              <Link href="/timecard-invoice?tab=invoice" className={linkClass}>
                請求書・領収書
              </Link>
            </li>
            <li>
              <Link href="/profile" className={linkClass}>
                プロフィール設定
              </Link>
            </li>
            <li>
              <Link href="/pj-switch" className={linkClass}>
                PJ変更
              </Link>
            </li>
            <li>
              <Link href="/corporate" className={linkClass}>
                企業管理者
              </Link>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ディレクター・管理</CardTitle>
          <CardDescription>リスト・依頼・KPI</CardDescription>
        </CardHeader>
        <CardContent>
          {canSeeTier1Or2 ? (
            <ul className="list-none space-y-2">
              <li>
                <Link href="/director" className={linkClass}>
                  ディレクター
                </Link>
              </li>
              <li>
                <Link href="/director/kpi" className={linkClass}>
                  プロジェクトKPI
                </Link>
              </li>
              <li>
                <Link href="/director/kpi-goals" className={linkClass}>
                  KPI目標設定
                </Link>
              </li>
              <li>
                <Link href="/director/talk-scripts" className={linkClass}>
                  トークスクリプト編集
                </Link>
              </li>
              <li>
                <Link href="/director/ai-report" className={linkClass}>
                  AIレポート
                </Link>
              </li>
              <li>
                <Link href="/director/daily-box" className={linkClass}>
                  日報BOX
                </Link>
              </li>
              <li>
                <Link href="/director/requests" className={linkClass}>
                  アポ・資料請求 管理
                </Link>
              </li>
              <li>
                <Link href="/director/reporting-formats" className={linkClass}>
                  ★報告フォーマット編集
                </Link>
              </li>
              <li>
                <Link href="/director/calling-lists/import" className={linkClass}>
                  リスト格納
                </Link>
              </li>
              <li>
                <Link href="/director/calling-lists/distribute" className={linkClass}>
                  リスト配布・管理
                </Link>
              </li>
              <li>
                <Link href="/admin" className={linkClass}>
                  役職変更・メンバー招待
                </Link>
              </li>
              <li>
                <Link href="/attendance-payroll" className={linkClass}>
                  出勤管理表＆報酬計算
                </Link>
              </li>
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              ディレクター・企業管理者などの権限で表示されるメニューです。
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="min-[900px]:col-span-2 xl:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">その他</CardTitle>
          <CardDescription>権限・配布</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-none space-y-2">
            {canSeeTier1Or2 ? (
              <>
                <li>
                  <Link href="/role-transfer" className={linkClass}>
                    権限委任
                  </Link>
                </li>
                <li>
                  <Link href="/list-distribution" className={linkClass}>
                    リスト配布
                  </Link>
                </li>
              </>
            ) : (
              <li className="text-sm text-zinc-500">権限委任・リスト配布は TIER1/2 のみ表示</li>
            )}
            <li>
              <span className="text-sm text-zinc-500">社内報（予定）</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
