'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SALES_ROOM_V2_BASE } from '@/lib/sales-room-paths'
import { useSession } from 'next-auth/react'
import { fetchAssignedCallingLists, fetchCallingLists, fetchListItems } from '@/lib/calling-api'
import type { ListItem } from '@/lib/types'

export const SEED_CALLING_LIST_ID = 'seed-calling-list-distribute-demo'

/** 未ログイン・API 空時の一覧用デモ行 */
export const buildDemoCallingListItems = (): ListItem[] => {
  const ts = new Date().toISOString()
  return [
    {
      id: 'local-demo-1',
      tenantId: 'tenant-demo-01',
      listId: 'local-demo',
      listName: 'デモ配布リスト',
      companyName: 'デモ飲食 銀座（ローカル表示）',
      phone: '03-0000-0001',
      address: '東京都中央区銀座1-1-1',
      targetUrl: 'https://example.com',
      industryTag: '飲食・レストラン',
      aiListTier: 'A',
      status: 'unstarted',
      createdAt: ts,
    },
    {
      id: 'local-demo-2',
      tenantId: 'tenant-demo-01',
      listId: 'local-demo',
      listName: 'デモ配布リスト',
      companyName: 'デモIT 渋谷（ローカル表示）',
      phone: '03-1000-0001',
      address: '東京都渋谷区神南1-1-1',
      targetUrl: 'https://example.com',
      industryTag: 'IT・ソフトウェア',
      aiListTier: 'B',
      status: 'unstarted',
      createdAt: ts,
    },
  ]
}

/**
 * 架電リスト明細の取得（一覧タブ・左パネルで共有）。URL 遷移は openCompanyFromRow。
 */
export function useCallingListRows() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const [rows, setRows] = useState<ListItem[]>([])
  const [source, setSource] = useState<'api' | 'demo'>('demo')
  const [hint, setHint] = useState<string | null>(
    'ログイン後、配布リストの明細を表示します。未ログイン時はデモ行です。',
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (sessionStatus === 'loading') return
      if (!session?.accessToken) {
        if (!cancelled) {
          setRows(buildDemoCallingListItems())
          setSource('demo')
          setHint('ログイン後、API の配布リストが表示されます（未ログイン時はデモ行）。')
          setLoading(false)
        }
        return
      }
      setLoading(true)
      setHint(null)
      try {
        const role = session.user?.role
        let listId: string | null = null
        if (role === 'is_member') {
          const assigned = await fetchAssignedCallingLists(session.accessToken)
          listId = assigned[0]?.id ?? null
        } else {
          const all = await fetchCallingLists(session.accessToken)
          const seed = all.find((l) => l.id === SEED_CALLING_LIST_ID)
          listId = seed?.id ?? all[0]?.id ?? null
        }
        if (!listId) {
          if (!cancelled) {
            setRows(buildDemoCallingListItems())
            setSource('demo')
            setHint(
              '配布リストが見つかりません。`npm run db:seed`（API）でシードするか、ディレクターがリストを配布してください。',
            )
          }
          return
        }
        const items = await fetchListItems(session.accessToken, listId)
        if (cancelled) return
        if (items.length > 0) {
          setRows(items)
          setSource('api')
          setHint(null)
        } else {
          setRows(buildDemoCallingListItems())
          setSource('demo')
          setHint('リスト明細が空です。シードの再実行または配布を確認してください。')
        }
      } catch {
        if (!cancelled) {
          setRows(buildDemoCallingListItems())
          setSource('demo')
          setHint('一覧の取得に失敗しました。API 起動とログインを確認してください。')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [session?.accessToken, session?.user?.role, sessionStatus])

  const openCompanyFromRow = useCallback(
    (item: ListItem) => {
      if (source === 'api') {
        const legalEntityId = item.legalEntityId ?? ''
        const qs = legalEntityId ? `&legalEntityId=${encodeURIComponent(legalEntityId)}` : ''
        router.push(
          `${SALES_ROOM_V2_BASE}?tab=company&listItemId=${encodeURIComponent(item.id)}${qs}`,
        )
        return
      }
      router.push(`${SALES_ROOM_V2_BASE}?tab=company`)
    },
    [router, source],
  )

  return { rows, source, hint, loading, openCompanyFromRow }
}
