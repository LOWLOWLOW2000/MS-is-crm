'use client'

import Link from 'next/link'

/** デフォルト: 日本の祝日カレンダー。環境変数 NEXT_PUBLIC_GOOGLE_CALENDAR_ID で自カレンダーに差し替え可能 */
const DEFAULT_GOOGLE_CALENDAR_ID = 'ja.japanese#holiday@group.v.calendar.google.com'

function getGoogleCalendarEmbedSrc(): string {
  const calendarId =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID
      ? process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID
      : DEFAULT_GOOGLE_CALENDAR_ID
  const params = new URLSearchParams({
    src: calendarId,
    ctz: 'Asia/Tokyo',
    showTitle: '0',
    showNav: '1',
    showDate: '1',
    showPrint: '0',
    showTabs: '1',
    showCalendars: '0',
    showTz: '0',
    mode: 'MONTH',
  })
  return `https://calendar.google.com/calendar/embed?${params.toString()}`
}

/**
 * 共通ページ: カレンダー。中央にGoogleカレンダーを埋め込み表示。
 * 左メニュー「カレンダー」のリンク先（/dashboard/calendar）。
 */
export default function CalendarPage() {
  return (
    <div className="flex min-h-0 flex-col">
      <h1 className="text-xl font-bold text-gray-900">カレンダー</h1>
      <p className="mt-1 text-sm text-gray-600">予定・稼働時間の確認（Googleカレンダー埋め込み）</p>

      {/* 内部リンク: メニュー・他ページへ */}
      <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="関連ページ">
        <Link href="/dashboard" className="text-blue-600 hover:underline">メニュー</Link>
        <Link href="/dashboard?view=corporate" className="text-blue-600 hover:underline">個人アカウント</Link>
        <Link href="/dashboard?view=kpi" className="text-blue-600 hover:underline">KPIページ（AI）</Link>
        <Link href="/dashboard?view=ai-daily" className="text-blue-600 hover:underline">日報（AI）</Link>
        <Link href="/sales-room" className="text-blue-600 hover:underline">架電ルーム</Link>
      </nav>

      {/* 中央: Googleカレンダー埋め込み */}
      <div className="mt-6 flex-1 min-h-[480px] rounded-lg border border-gray-200 bg-white overflow-hidden">
        <iframe
          src={getGoogleCalendarEmbedSrc()}
          title="Googleカレンダー"
          className="h-full w-full border-0"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          allowFullScreen
        />
      </div>

      {/* 主要項目のマークのみ */}
      <div className="mt-8 border-t border-gray-200 pt-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">主要項目</p>
        <ul className="mt-3 flex flex-wrap gap-4" role="list">
          <li className="flex items-center gap-2 text-sm text-gray-600">
            <span className="h-3 w-3 rounded-full bg-blue-500" aria-hidden />
            予定
          </li>
          <li className="flex items-center gap-2 text-sm text-gray-600">
            <span className="h-3 w-3 rounded-full bg-amber-500" aria-hidden />
            稼働
          </li>
          <li className="flex items-center gap-2 text-sm text-gray-600">
            <span className="h-3 w-3 rounded-full bg-green-500" aria-hidden />
            架電予約
          </li>
          <li className="flex items-center gap-2 text-sm text-gray-600">
            <span className="h-3 w-3 rounded-full bg-red-500" aria-hidden />
            締切
          </li>
        </ul>
      </div>
    </div>
  )
}
