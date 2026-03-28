import { Suspense } from 'react'
import { MockShell } from '@/components/MockShell'
import { SalesRoomClassicContent } from './_components/SalesRoomClassicContent'
import { SalesRoomClassicLeftPanel } from './_components/SalesRoomClassicLeftPanel'

/**
 * 架電ルーム（従来）: モック顧客リスト + コックピット（CompanyDetailTemplate）。
 * CallSessionProvider は親 layout（SalesRoomProviders）が供給。
 * フル API リストは /sales-room/v2 。
 */
export default function SalesRoomPage() {
  return (
    <MockShell
      hideScrollbars
      leftPanelBelowNav={
        <Suspense fallback={<div className="p-2 text-[11px] text-zinc-500">読込中…</div>}>
          <SalesRoomClassicLeftPanel />
        </Suspense>
      }
    >
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-gray-500">
            読み込み中...
          </div>
        }
      >
        <SalesRoomClassicContent />
      </Suspense>
    </MockShell>
  )
}
