import type { ReactNode } from 'react'
import { SalesRoomShell } from '../SalesRoomShell'

/**
 * API コックピット用シェル（左リスト・CallSession）。
 */
export default function SalesRoomV2Layout({ children }: { children: ReactNode }) {
  return <SalesRoomShell>{children}</SalesRoomShell>
}
