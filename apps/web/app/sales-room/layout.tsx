import type { ReactNode } from 'react'
import { MockShell } from '@/components/MockShell'
import { SalesRoomCallStatusDock } from '@/components/SalesRoomCallStatusDock'

/**
 * 営業ルーム。このページのみヘッダー・フッター・左カラム（ナビ）あり。階層: / → /login → /office → /sales-room
 */
export default function SalesRoomLayout({ children }: { children: ReactNode }) {
  return <MockShell leftPanelBelowNav={<SalesRoomCallStatusDock />}>{children}</MockShell>
}
