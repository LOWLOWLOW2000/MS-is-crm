'use client'

import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import { MockNav } from './MockNav'
import { FooterChatRollup } from './FooterChatRollup'
import { DailyKpiSection } from './DailyKpiSection'

export interface MockShellProps {
  children: React.ReactNode
  /** 営業ルーム用。指定時は左カラムをナビ＋このパネルの2段にし、電話制御が日報BOXの下に収まる。 */
  leftPanelBelowNav?: React.ReactNode
  /** 無料プラン時は当日KPIセクションに広告オーバーレイ（×で閉じる）を表示。デフォルト true */
  isFreeTier?: boolean
}

/**
 * モック（docs/html-mock）準拠の共通シェル。ヘッダー（IS UI・プロフアイコン）＋当日KPIセクション＋左ナビ＋メイン＋フッター。
 */
export function MockShell({ children, leftPanelBelowNav, isFreeTier = true }: MockShellProps) {
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
      {/* 上部ヘッダー一列固定：IS UI | 当日KPI（個人・チーム・PJ） | プロフ。無料時はKPI部分に広告オーバーレイ＋× */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4">
        <div className="shrink-0">
          <Link
            href="/dashboard"
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            IS UI
          </Link>
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
                プロフィールページ
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
        <div className="flex min-h-0 flex-1">
          <div className={`flex shrink-0 flex-col min-h-0 border-r border-gray-200 bg-white ${leftColWidth}`}>
            <MockNav />
            {leftPanelBelowNav != null ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {leftPanelBelowNav}
              </div>
            ) : null}
          </div>
          <main className="flex min-h-0 flex-1 flex-col overflow-auto bg-gray-50 p-6 min-w-0">
            <div className="flex min-h-0 flex-1 flex-col">
              {children}
            </div>
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
