import { Suspense } from 'react'
import { SalesRoomContent } from './_components/SalesRoomContent'

/** プリレンダーと RSC キャッシュの取り違いによる開発時 500 を減らす */
export const dynamic = 'force-dynamic'

/**
 * 営業ルーム。useSearchParams を使うため Suspense でラップ（表示されない問題を回避）。
 */
export default function SalesRoomPage() {
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
