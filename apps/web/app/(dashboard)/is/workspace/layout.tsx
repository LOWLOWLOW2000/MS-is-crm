import type { ReactNode } from 'react'
import { IsWorkspaceTabBar } from './IsWorkspaceTabBar'

export default function IsWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl text-base leading-relaxed text-gray-900">
      <IsWorkspaceTabBar />
      {children}
    </div>
  )
}
