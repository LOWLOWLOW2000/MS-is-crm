import type { ReactNode } from 'react'
import { SalesRoomBodyScrollLock } from './SalesRoomBodyScrollLock'
import { SalesRoomProviders } from './SalesRoomProviders'

/**
 * 営業ルーム配下共通: スクロールロック + CallSessionProvider（架電コンテキスト）。
 * シェルは `/sales-room`（MockShell）と v2 / 精査（SalesRoomShell）で個別に適用。
 */
export default function SalesRoomLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SalesRoomBodyScrollLock />
      <SalesRoomProviders>{children}</SalesRoomProviders>
    </>
  )
}
