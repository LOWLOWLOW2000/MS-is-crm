import type { ReactNode } from 'react'
import { SalesRoomShell } from '../SalesRoomShell'

/**
 * 精査ページも API コックピットと同じシェル（左リスト・架電コンテキスト）を利用。
 */
export default function SalesRoomRefinementLayout({ children }: { children: ReactNode }) {
  return <SalesRoomShell>{children}</SalesRoomShell>
}
