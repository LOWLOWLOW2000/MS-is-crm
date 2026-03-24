'use client'

import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { MockNav } from './MockNav'
import { FooterChatRollup } from './FooterChatRollup'
import { DailyKpiSection } from './DailyKpiSection'
import { formatHeaderRolesJa } from '@/lib/role-labels'
import type { UserRole } from '@/lib/types'

export interface MockShellProps {
  children: React.ReactNode
  /** 営業ルーム用。指定時は左カラムをナビ＋このパネルの2段にし、電話制御が日報BOXの下に収まる。 */
  leftPanelBelowNav?: React.ReactNode
  /** 無料プラン時は当日KPIセクションに広告オーバーレイ（×で閉じる）を表示。デフォルト true */
  isFreeTier?: boolean
}

/**
 * モック（docs/html-mock）準拠の共通シェル。ヘッダー（所属企業・PJ名・自分名・役職／プロフ）＋当日KPI＋左ナビ＋メイン＋フッター。
 */
export function MockShell({ children, leftPanelBelowNav, isFreeTier = true }: MockShellProps) {
  const { data: session, status } = useSession()
  const leftColWidth = leftPanelBelowNav ? 'w-72' : 'w-52'
  const [profilePopupOpen, setProfilePopupOpen] = useState(false)
  const [kpiAdDismissed, setKpiAdDismissed] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfilePopupOpen(false)
      }
    }
    if (profilePopupOpen) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [profilePopupOpen])

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* 上部ヘッダー一列固定：所属企業・PJ名・自分名・役職 | 当日KPI | プロフ */}
      <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 py-1.5">
        <div className="min-w-0 max-w-[min(100%,18rem)] shrink-0 sm:max-w-md">
          {status === 'loading' ? (
            <div className="h-14 w-44 animate-pulse rounded-md bg-gray-100" aria-hidden />
          ) : session?.user ? (
            <Link
              href="/dashboard"
              className="flex min-w-0 flex-col justify-center gap-0.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-left leading-snug hover:bg-gray-100"
              title="ダッシュボードへ"
            >
              <span className="truncate text-[11px] text-gray-800">
                <span className="font-medium text-gray-500">所属企業</span>
                <span className="mx-0.5 text-gray-400">：</span>
                <span>{session.user.tenantCompanyName || '未設定'}</span>
              </span>
              <span className="truncate text-[11px] text-gray-800">
                <span className="font-medium text-gray-500">PJ名</span>
                <span className="mx-0.5 text-gray-400">：</span>
                <span>{session.user.tenantProjectName || '未設定'}</span>
              </span>
              <span className="truncate text-[11px] text-gray-800">
                <span className="font-medium text-gray-500">自分名</span>
                <span className="mx-0.5 text-gray-400">：</span>
                <span className="font-semibold text-gray-900">{session.user.name}</span>
              </span>
              <span className="truncate text-[11px] text-gray-800">
                <span className="font-medium text-gray-500">役職</span>
                <span className="mx-0.5 text-gray-400">：</span>
                <span>
                  {formatHeaderRolesJa((session.user.roles ?? [session.user.role]) as UserRole[])}
                </span>
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              ログイン
            </Link>
          )}
        </div>
        <div className="relative flex min-w-0 flex-1 items-center">
          <DailyKpiSection inline />
          {isFreeTier && !kpiAdDismissed && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-end gap-2 bg-black/40 px-2"
              aria-label="広告オーバーレイ"
            >
              <span className="absolute left-1/2 -translate-x-1/2 rounded bg-white/95 px-3 py-1.5 text-xs font-medium text-gray-800 shadow">
                無料プラン — 広告表示
              </span>
              <button
                type="button"
                onClick={() => setKpiAdDismissed(true)}
                className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/90 text-gray-700 hover:bg-white"
                aria-label="広告を閉じる"
              >
                ×
              </button>
            </div>
          )}
        </div>
        <div className="relative shrink-0" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfilePopupOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300"
            aria-label="アカウント"
            aria-expanded={profilePopupOpen}
            aria-haspopup="true"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </button>
          {profilePopupOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              role="menu"
              aria-label="アカウントメニュー"
            >
              <Link
                href="/profile"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                role="menuitem"
                onClick={() => setProfilePopupOpen(false)}
              >
                プロフィール設定
              </Link>
              <Link
                href="/login"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                role="menuitem"
                onClick={() => setProfilePopupOpen(false)}
              >
                ログアウト（アカウント変更）
              </Link>
            </div>
          )}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col pb-12">
        <div className="flex min-h-[calc(100dvh-3.5rem)] flex-1">
          <div className={`flex min-h-0 shrink-0 flex-col border-r border-gray-200 bg-white ${leftColWidth}`}>
            <MockNav />
            {leftPanelBelowNav != null ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {leftPanelBelowNav}
              </div>
            ) : null}
          </div>
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto bg-gray-50 p-6">
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </main>
          <aside className="w-0 shrink-0" aria-hidden />
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <FooterChatRollup />
      </div>
    </div>
  )
}
