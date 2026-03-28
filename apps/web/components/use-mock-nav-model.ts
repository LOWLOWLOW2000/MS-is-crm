'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { fetchDirectorRequestsSummary, fetchMyProfile } from '@/lib/calling-api'
import type { UserRole } from '@/lib/types'
import { MOCK_NAV_ITEMS, type NavLayer } from './mock-nav-config'

type ViewerLayer = NavLayer | 'all'

function normalizeUserRoles(user: unknown): UserRole[] {
  const u = user as { role?: UserRole; roles?: UserRole[] } | null | undefined
  if (!u) return []
  if (Array.isArray(u.roles) && u.roles.length > 0) return u.roles
  if (u.role) return [u.role]
  return []
}

/**
 * 左ナビ（MockNav）と同一の表示可否・バッジ用データ。架電ルーム aside のミニメニューでも利用。
 */
export function useMockNavModel() {
  const pathname = usePathname() ?? ''
  const { data: session, status } = useSession()

  const sessionRoles = status === 'authenticated' ? normalizeUserRoles(session?.user) : []
  const [resolvedRoles, setResolvedRoles] = useState<UserRole[]>([])
  const [directorRequestBadgeCount, setDirectorRequestBadgeCount] = useState<number>(0)
  const effectiveRoles = resolvedRoles.length > 0 ? resolvedRoles : sessionRoles

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!session?.accessToken) return
      try {
        const prof = await fetchMyProfile(session.accessToken)
        const allowed = new Set<UserRole>([
          'developer',
          'enterprise_admin',
          'is_admin',
          'director',
          'is_member',
        ])
        const parsed = (prof.roles ?? []).filter((r): r is UserRole => allowed.has(r as UserRole))
        if (!cancelled) setResolvedRoles(parsed)
      } catch {
        // 失敗時は sessionRoles にフォールバック
      }
    }

    void run()
    const onRolesChanged = () => void run()
    if (typeof window !== 'undefined') {
      window.addEventListener('roles:changed', onRolesChanged)
    }
    return () => {
      cancelled = true
      if (typeof window !== 'undefined') {
        window.removeEventListener('roles:changed', onRolesChanged)
      }
    }
  }, [session?.accessToken])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!session?.accessToken) return
      try {
        const summary = await fetchDirectorRequestsSummary(session.accessToken)
        if (!cancelled) setDirectorRequestBadgeCount(summary.unreadTotal)
      } catch {
        if (!cancelled) setDirectorRequestBadgeCount(0)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [session?.accessToken])

  const hasDirector = effectiveRoles.some((r) => r === 'director' || r === 'developer')
  const hasIs = effectiveRoles.some((r) => r === 'is_member' || r === 'is_admin')
  const hasEnterpriseAdmin = effectiveRoles.some((r) => r === 'enterprise_admin')

  const viewerLayer: ViewerLayer = hasDirector ? 'director' : hasIs ? 'is' : hasEnterpriseAdmin ? 'is' : 'all'

  const visibleItems = MOCK_NAV_ITEMS.filter((item) => {
    if (item.layer === 'enterprise') {
      return hasEnterpriseAdmin
    }
    if (item.layer === 'director') {
      return viewerLayer === 'all' || viewerLayer === 'director'
    }
    return viewerLayer === 'all' || viewerLayer === 'director' || viewerLayer === 'is'
  })

  const visibleHrefPaths = new Set<string>(visibleItems.map((item) => item.href.split('?')[0]))
  if (hasEnterpriseAdmin) visibleHrefPaths.add('/admin')

  const visibleItemsWithAdminException = MOCK_NAV_ITEMS.filter((item) =>
    visibleHrefPaths.has(item.href.split('?')[0]),
  )

  return {
    pathname,
    session,
    status,
    visibleItemsWithAdminException,
    directorRequestBadgeCount,
  }
}
