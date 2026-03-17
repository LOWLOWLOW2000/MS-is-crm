'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { UserAvatar } from '@carbon/icons-react'

/**
 * TOP ページ用ヘッダ。左: ブランド or アカウントアイコン（ログイン済み）、右: ログインボタンのみ。
 */
export function TopHeader() {
  const { data: session, status } = useSession()
  const isLoggedIn = status === 'authenticated' && session != null

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
      <div className="flex items-center">
        {isLoggedIn ? (
          <Link
            href="/dashboard"
            className="flex items-center justify-center rounded-full p-1.5 text-gray-600 hover:bg-gray-100"
            aria-label="アカウント・メニューへ"
          >
            <UserAvatar size={24} />
          </Link>
        ) : (
          <Link
            href="/"
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            IS CRM
          </Link>
        )}
      </div>
      <div className="flex items-center">
        <Link
          href="/login"
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          {isLoggedIn ? 'ログアウト' : 'ログイン'}
        </Link>
      </div>
    </header>
  )
}
