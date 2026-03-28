'use client'

import type { ReactNode } from 'react'
import { CallSessionProvider } from './_providers/CallSessionProvider'

/**
 * `/sales-room` 配下すべてで架電セッションコンテキストを1箇所で供給する。
 * page / Shell を Server コンポーネントに戻しても CompanyDetailTemplate が確実に包まれる。
 */
export function SalesRoomProviders({ children }: { children: ReactNode }) {
  return <CallSessionProvider>{children}</CallSessionProvider>
}
