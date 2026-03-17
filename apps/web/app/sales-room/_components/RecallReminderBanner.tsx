'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRecallListStore } from '@/lib/stores/recall-list-store'

const ONE_MIN_MS = 60 * 1000
const THREE_MIN_MS = 3 * 60 * 1000

/**
 * 架電予定が3分前・1分前に近づくと表示。AIチャット風で架電を促す＋ページ直リンク。
 */
export function RecallReminderBanner() {
  const items = useRecallListStore((s) => s.items)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000)
    return () => clearInterval(id)
  }, [])

  const upcoming = items
    .filter((item) => item.scheduledAt > now && item.scheduledAt - now <= THREE_MIN_MS)
    .map((item) => ({
      ...item,
      minutesLeft: Math.max(1, Math.ceil((item.scheduledAt - now) / ONE_MIN_MS)),
    }))
    .sort((a, b) => a.scheduledAt - b.scheduledAt)

  if (upcoming.length === 0) return null

  const top = upcoming[0]
  const label = top.minutesLeft <= 1 ? '1分前' : `${top.minutesLeft}分前`

  return (
    <div
      className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm"
      role="alert"
      aria-live="polite"
    >
      <p className="text-sm font-medium text-amber-900">
        <span className="font-semibold">AIリマインド：</span>
        {label} — {top.companyName} の架電予定です。架電を開始しましょう。
      </p>
      <Link
        href={top.pageLink}
        className="shrink-0 rounded bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
      >
        ページへ直リンク
      </Link>
    </div>
  )
}
