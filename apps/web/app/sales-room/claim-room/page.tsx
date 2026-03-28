import Link from 'next/link'
import { MockShell } from '@/components/MockShell'
import { SALES_ROOM_V2_BASE } from '@/lib/sales-room-paths'

/**
 * クレーム対応専用の架電ルーム（プレースホルダ）。通常架電ルームから遷移する。
 */
export default function ClaimCallingRoomPage() {
  return (
    <MockShell hideScrollbars>
      <div className="mx-auto max-w-lg space-y-4 rounded-lg border border-amber-200 bg-amber-50/40 p-6 text-center">
        <h1 className="text-lg font-semibold text-amber-950">クレーム対応架電ルーム</h1>
        <p className="text-sm text-gray-700">
          架電結果「クレーム」が付いた案件の専用フロー用です。ここから通常の架電ルームへ戻れます。
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/sales-room"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            従来架電ルームへ
          </Link>
          <Link
            href={SALES_ROOM_V2_BASE}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            API 架電ルームへ
          </Link>
        </div>
      </div>
    </MockShell>
  )
}
