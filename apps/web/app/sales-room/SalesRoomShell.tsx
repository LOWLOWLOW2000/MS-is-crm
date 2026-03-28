'use client'

import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { MockShell } from '@/components/MockShell'
import { SalesRoomLeftPanel } from './_components/SalesRoomLeftPanel'

/**
 * 営業ルーム専用シェル: 左リストパネル（ナビ下）。架電セッションは親 layout の SalesRoomProviders。
 */
export function SalesRoomShell({ children }: { children: ReactNode }) {
  return (
    <MockShell
      hideScrollbars
      leftPanelBelowNav={
        <Suspense fallback={<div className="p-2 text-xs text-zinc-500">読込中…</div>}>
          <SalesRoomLeftPanel />
        </Suspense>
      }
    >
      {children}
    </MockShell>
  )
}
