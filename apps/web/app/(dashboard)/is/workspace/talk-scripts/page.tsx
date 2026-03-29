'use client'

import { useSession } from 'next-auth/react'
import { SalesRoomTalkScriptPanel } from '@/app/sales-room/_components/SalesRoomTalkScriptPanel'

/**
 * 公開済みトークスクリプトの閲覧・進行（IS ワークスペース）
 */
export default function IsWorkspaceTalkScriptsPage() {
  const { data: session, status } = useSession()
  const accessToken = (session as unknown as { accessToken?: string } | null)?.accessToken ?? null

  if (status === 'loading') {
    return <p className="text-lg text-gray-700">読み込み中…</p>
  }

  if (!accessToken) {
    return <p className="text-lg text-gray-700">ログインが必要です</p>
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">トークスクリプト</h1>
        <p className="mt-2 text-lg text-gray-800">
          ディレクターが公開したスクリプトをここで確認・進行します
        </p>
      </header>
      <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-6">
        <SalesRoomTalkScriptPanel accessToken={accessToken} />
      </div>
    </div>
  )
}
