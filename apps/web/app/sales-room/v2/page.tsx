import { Suspense } from 'react'
import { SalesRoomContent } from '../_components/SalesRoomContent'

export const dynamic = 'force-dynamic'

/**
 * 架電ルーム（API リスト・コックピット）。
 */
export default function SalesRoomV2Page() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-gray-500">
          読み込み中...
        </div>
      }
    >
      <SalesRoomContent />
    </Suspense>
  )
}
