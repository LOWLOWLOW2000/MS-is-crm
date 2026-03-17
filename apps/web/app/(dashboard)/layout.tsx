import type { ReactNode } from 'react'
import { MockShell } from '@/components/MockShell'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <MockShell>
      <article className="flex min-h-0 flex-1 flex-col" aria-label="メインコンテンツ">
        {children}
      </article>
    </MockShell>
  )
}
