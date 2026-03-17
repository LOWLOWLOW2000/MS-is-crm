'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import type { UserRole } from '@/lib/types'

const ROLE_LABEL: Record<UserRole, string> = {
  is_member: 'IS',
  director: 'ディレクター',
  enterprise_admin: '企業管理者',
  is_admin: '企業管理者',
  developer: '開発者',
}

const TICKER_MESSAGES = [
  '本日の架電目標: 30件',
  '優先フォロー: 再架電リスト 5件',
  'ディレクターからのお知らせ: 定例会 14:00',
  '高確度リード: 山田商事・佐藤エンタープライズ',
]

const ROTATE_INTERVAL_MS = 10_000

/**
 * トップバナー左: 役職タブ（自分のアカウントの役職）＋ 電光掲示板（白地・薄い灰文字・10秒ごとに切り替え）。
 */
export function SalesRoomAITicker() {
  const { data: session, status } = useSession()
  const role = (status === 'authenticated' && session?.user?.role
    ? session.user.role
    : null) as UserRole | null
  const roleLabel = role ? ROLE_LABEL[role] ?? role : '—'

  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setMessageIndex((i) => (i + 1) % TICKER_MESSAGES.length)
    }, ROTATE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <section
      className="flex h-full w-full items-center gap-3 overflow-hidden bg-white px-3"
      aria-label="役職・お知らせ"
    >
      <span className="shrink-0 rounded bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700">
        {roleLabel}
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate text-sm text-gray-400">
          {TICKER_MESSAGES[messageIndex]}
        </p>
      </div>
    </section>
  )
}
