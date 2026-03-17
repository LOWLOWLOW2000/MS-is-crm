import type { ReactNode } from 'react'
import Link from 'next/link'
import { FooterChatRollup } from '@/components/FooterChatRollup'

/**
 * Office 用レイアウト。ヘッダ（ボタンは全て左寄せ）＋メイン＋フッター固定。
 */
export default function OfficeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex h-14 shrink-0 items-center justify-start gap-3 border-b border-gray-200 bg-white px-4">
        <Link
          href="/sales-room"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          営業ルームへ
        </Link>
        <Link
          href="/login"
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ログインへ戻る
        </Link>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-auto bg-gray-50 p-6">
        {children}
      </main>
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <FooterChatRollup />
      </div>
      <div className="h-12 shrink-0" aria-hidden />
    </div>
  )
}
