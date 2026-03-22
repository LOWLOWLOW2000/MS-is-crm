'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { CompanyDetailTemplate } from './CompanyDetailTemplate'
import { SalesRoomActionResultPanel } from './SalesRoomActionResultPanel'
import { RecallReminderBanner } from './RecallReminderBanner'
import { useTalkScriptStore } from '@/lib/stores/talk-script-store'
import { NotionBlockEditor } from './NotionBlockEditor'
import {
  fetchAssignedCallingLists,
  fetchCallingLists,
  fetchListItems,
} from '@/lib/calling-api'
import type { ListItem } from '@/lib/types'

/** トーク用サブタブ：管理職がセット / 自分で書く */
const TALK_SUB_TABS = [
  { key: 'manager', label: '管理職がセット' },
  { key: 'self', label: '自分で書く' },
] as const

/** KPI スコープ：全体 / Team / 個人 */
const KPI_SCOPES = [
  { key: 'all', label: '全体' },
  { key: 'team', label: 'Team' },
  { key: 'individual', label: '個人' },
] as const

const TAB_ITEMS: { key: string; label: string }[] = [
  { key: 'company', label: '企業詳細' },
  { key: 'talk', label: 'トーク' },
  { key: 'rules', label: '案件ルール' },
  { key: 'kpi', label: 'KPI' },
  { key: 'daily', label: '日報' },
  { key: 'memo-c', label: '自由メモ（案件）' },
]

const TAB_KEYS_BASE = TAB_ITEMS.map((t) => t.key)
const TAB_MAP = Object.fromEntries(TAB_ITEMS.map((t) => [t.key, t.label]))
const DEFAULT_TAB = 'company'
const STORAGE_KEY = 'sales-room-tab-order'

/** 架電一覧の時間帯別スロット */
const TIME_SLOT_OPTIONS = [
  { key: '9-12', label: '9–12時' },
  { key: '12-14', label: '12–14時' },
  { key: '14-18', label: '14–18時' },
] as const

const SEED_LIST_ID = 'seed-calling-list-distribute-demo'

/** 未ログイン・API 空時の一覧用デモ行（DB シードと近い見た目） */
const buildDemoListItems = (): ListItem[] => {
  const ts = new Date().toISOString()
  return [
    {
      id: 'local-demo-1',
      tenantId: 'tenant-demo-01',
      listId: 'local-demo',
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

const prefectureFromAddress = (address: string): string => {
  const m = address.match(/^(.+?[都道府県])/)
  if (m?.[1]) return m[1]
  return address.length > 0 ? address.slice(0, 6) : '—'
}

function loadTabOrder(baseKeys: string[]): string[] {
  if (typeof window === 'undefined') return [...baseKeys]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...baseKeys]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...baseKeys]
    const valid = parsed.filter((k): k is string => typeof k === 'string' && baseKeys.includes(k))
    const missing = baseKeys.filter((k) => !valid.includes(k))
    return [...valid, ...missing]
  } catch {
    return [...baseKeys]
  }
}

/**
 * 営業ルームメイン。上＝タブナビ（並び替え可・クリックでアクティブ色）、下＝選択タブの結果表示。
 */
export function SalesRoomContent() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const searchParams = useSearchParams()
  const legalEntityIdFromUrl =
    searchParams.get('legalEntityId') ?? searchParams.get('company') ?? ''
  const listItemIdFromUrl = searchParams.get('listItemId') ?? ''
  const tabKeys = ['list', ...TAB_KEYS_BASE]
  const tabMap: Record<string, string> = { list: '一覧', ...TAB_MAP }
  const tab = searchParams.get('tab') ?? DEFAULT_TAB
  const activeTab = tabKeys.includes(tab) ? tab : DEFAULT_TAB
  const activeLabel = tabMap[activeTab] ?? '企業詳細'

  const [tabOrder, setTabOrder] = useState<string[]>(() => loadTabOrder(tabKeys))
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [talkSubTab, setTalkSubTab] = useState<string>(TALK_SUB_TABS[0].key)
  const [kpiScope, setKpiScope] = useState<string>(KPI_SCOPES[0].key)
  const [timeSlot, setTimeSlot] = useState<string>(TIME_SLOT_OPTIONS[0].key)
  const selfTabs = useTalkScriptStore((s) => s.selfTabs)
  const activeSelfTabId = useTalkScriptStore((s) => s.activeSelfTabId)
  const setActiveSelfTabId = useTalkScriptStore((s) => s.setActiveSelfTabId)
  const updateSelfTabContent = useTalkScriptStore((s) => s.updateSelfTabContent)
  const addSelfTab = useTalkScriptStore((s) => s.addSelfTab)

  const [callingRows, setCallingRows] = useState<ListItem[]>([])
  const [callingListSource, setCallingListSource] = useState<'api' | 'demo'>('demo')
  const [callingListHint, setCallingListHint] = useState<string | null>(
    'ログイン後、配布リストの明細を表示します。未ログイン時はデモ行です。',
  )
  const [callingListLoading, setCallingListLoading] = useState(false)

  useEffect(() => {
    setTabOrder(loadTabOrder(tabKeys))
  }, [tabKeys.join(',')])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (sessionStatus === 'loading') return
      if (!session?.accessToken) {
        if (!cancelled) {
          setCallingRows(buildDemoListItems())
          setCallingListSource('demo')
          setCallingListHint('ログイン後、API の配布リストが表示されます（未ログイン時はデモ行）。')
          setCallingListLoading(false)
        }
        return
      }
      setCallingListLoading(true)
      setCallingListHint(null)
      try {
        const role = session.user?.role
        let listId: string | null = null
        if (role === 'is_member') {
          const assigned = await fetchAssignedCallingLists(session.accessToken)
          listId = assigned[0]?.id ?? null
        } else {
          const all = await fetchCallingLists(session.accessToken)
          const seed = all.find((l) => l.id === SEED_LIST_ID)
          listId = seed?.id ?? all[0]?.id ?? null
        }
        if (!listId) {
          if (!cancelled) {
            setCallingRows(buildDemoListItems())
            setCallingListSource('demo')
            setCallingListHint(
              '配布リストが見つかりません。`npm run db:seed`（API）でシードするか、ディレクターがリストを配布してください。',
            )
          }
          return
        }
        const items = await fetchListItems(session.accessToken, listId)
        if (cancelled) return
        if (items.length > 0) {
          setCallingRows(items)
          setCallingListSource('api')
          setCallingListHint(null)
        } else {
          setCallingRows(buildDemoListItems())
          setCallingListSource('demo')
          setCallingListHint('リスト明細が空です。シードの再実行または配布を確認してください。')
        }
      } catch {
        if (!cancelled) {
          setCallingRows(buildDemoListItems())
          setCallingListSource('demo')
          setCallingListHint('一覧の取得に失敗しました。API 起動とログインを確認してください。')
        }
      } finally {
        if (!cancelled) setCallingListLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [session?.accessToken, session?.user?.role, sessionStatus])

  const openCompanyFromRow = useCallback(
    (item: ListItem) => {
      if (callingListSource === 'api') {
        router.push(`/sales-room?tab=company&listItemId=${encodeURIComponent(item.id)}`)
        return
      }
      router.push('/sales-room?tab=company')
    },
    [callingListSource, router],
  )

  const persistOrder = useCallback((next: string[]) => {
    setTabOrder(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index)
    e.dataTransfer.setData('text/plain', String(index))
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropIndex(index)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDropIndex(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault()
      setDragIndex(null)
      setDropIndex(null)
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
      if (Number.isNaN(fromIndex) || fromIndex === toIndex) return
      const next = [...tabOrder]
      const [removed] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, removed)
      persistOrder(next)
    },
    [tabOrder, persistOrder]
  )

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDropIndex(null)
  }, [])

  const orderedKeys =
    tabOrder.length === tabKeys.length ? tabOrder : loadTabOrder(tabKeys)

  return (
    <div className="flex h-full min-h-[400px] flex-1 flex-col overflow-hidden">
      <nav
        className="shrink-0 border-b border-gray-200 bg-white px-4 pt-2"
        aria-label="メインエリアタブ"
      >
        <div className="flex flex-wrap items-center gap-1">
          {orderedKeys.map((key, index) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('tab', key)
            const isActive = activeTab === key
            const label = tabMap[key] ?? key
            const isDropTarget = dropIndex === index
            const isDragging = dragIndex === index
            return (
              <div
                key={key}
                className={`flex items-center rounded-t border transition-colors ${
                  isDropTarget
                    ? 'border-blue-400 border-b-0 bg-blue-50'
                    : isActive
                      ? 'border-b-0 border-gray-200 border-t-blue-300 bg-blue-600 shadow-sm'
                      : 'border-transparent border-b-gray-200 bg-white hover:bg-gray-50'
                } ${isDragging ? 'opacity-50' : ''}`}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
              >
                <span
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  className="cursor-grab touch-none px-1.5 py-2 text-gray-400 hover:text-gray-600 active:cursor-grabbing"
                  title="ドラッグで並び替え"
                  aria-hidden
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="inline-block">
                    <circle cx="4" cy="4" r="1" />
                    <circle cx="4" cy="8" r="1" />
                    <circle cx="8" cy="4" r="1" />
                    <circle cx="8" cy="8" r="1" />
                  </svg>
                </span>
                <Link
                  href={`/sales-room?${params.toString()}`}
                  className={`rounded px-2 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {label}
                </Link>
              </div>
            )
          })}
        </div>
      </nav>

      {/* 下：選択タブの結果表示（IS UI メインエリア） */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-gray-100 p-0">
        <RecallReminderBanner />

        {activeTab === 'list' && (
          <div className="shrink-0 space-y-4">
            <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">架電一覧（時間帯別）</h2>
              <p className="mt-1 text-sm text-gray-500">
                時間帯は今後フィルタ連携予定。行クリックで企業詳細へ。
                {callingListSource === 'demo' && (
                  <span className="ml-1 font-medium text-amber-800">（デモ表示）</span>
                )}
                {callingListSource === 'api' && (
                  <span className="ml-1 font-medium text-green-800">（API）</span>
                )}
              </p>
              {callingListHint != null && (
                <p className="mt-2 text-xs text-gray-600">{callingListHint}</p>
              )}
              {callingListLoading && (
                <p className="mt-2 text-xs text-gray-500">一覧を読み込み中…</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {TIME_SLOT_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTimeSlot(key)}
                    className={`rounded px-3 py-1.5 text-sm font-medium ${
                      timeSlot === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto rounded border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 font-medium text-gray-900">リストNo</th>
                      <th className="px-3 py-2 font-medium text-gray-900">企業名</th>
                      <th className="px-3 py-2 font-medium text-gray-900">電話番号</th>
                      <th className="px-3 py-2 font-medium text-gray-900">カテゴリ</th>
                      <th className="px-3 py-2 font-medium text-gray-900">エリア</th>
                      <th className="px-3 py-2 font-medium text-gray-900">業種</th>
                      <th className="px-3 py-2 font-medium text-gray-900">架電回数</th>
                      <th className="px-3 py-2 font-medium text-gray-900">架電履歴</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {callingRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                          表示する行がありません。（
                          {TIME_SLOT_OPTIONS.find((o) => o.key === timeSlot)?.label ?? timeSlot}）
                        </td>
                      </tr>
                    ) : (
                      callingRows.map((item, idx) => (
                        <tr
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openCompanyFromRow(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              openCompanyFromRow(item)
                            }
                          }}
                          className="cursor-pointer hover:bg-blue-50/80"
                        >
                          <td className="px-3 py-2 text-gray-700">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{item.companyName}</td>
                          <td className="px-3 py-2 text-gray-700">{item.phone}</td>
                          <td className="px-3 py-2 text-gray-600">{item.aiListTier ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{prefectureFromAddress(item.address)}</td>
                          <td className="px-3 py-2 text-gray-600">{item.industryTag ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-500">—</td>
                          <td className="px-3 py-2 text-gray-500">—</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'company' && (
          <div className="shrink-0 space-y-2">
            <CompanyDetailTemplate
              legalEntityId={legalEntityIdFromUrl}
              listItemId={listItemIdFromUrl}
            />
          </div>
        )}

        {activeTab === 'talk' && (
          <div className="shrink-0 space-y-6">
            <div className="rounded-md border border-gray-200 bg-white shadow-sm">
              <h2 className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-base font-semibold text-gray-900">
                行動結果・メモ
              </h2>
              <div className="p-4">
                <p className="mb-3 text-xs text-gray-500">上部タブで「管理職がセット」と「自分で書く」を切り替え。メモ帳形式。</p>
                {/* 親タブ：管理職がセット / 自分で書く */}
                <div className="mb-3 flex gap-1 border-b border-gray-200">
                  {TALK_SUB_TABS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTalkSubTab(key)}
                      className={`rounded-t px-3 py-2 text-sm font-medium ${
                        talkSubTab === key
                          ? 'border border-b-0 border-gray-200 border-t-blue-300 bg-white text-blue-700 shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* コンテンツ：管理職タブ / 自分タブごとに内部タブ構造を持つ */}
                <div className="min-h-[220px] rounded border border-gray-200 bg-gray-50/50 p-3">
                  {talkSubTab === 'manager' ? (
                    <div className="flex h-full flex-col">
                      {/* 管理職がセットしたスクリプトタブ（ダミーデータ） */}
                      <div className="mb-2 flex flex-wrap gap-1 border-b border-gray-200 pb-1 text-xs">
                        {['受付突破トーク', '導入トーク', '反論対応', 'クロージング'].map((name, idx) => (
                          <button
                            key={name}
                            type="button"
                            className={`rounded-t border px-2.5 py-1 ${
                              idx === 0
                                ? 'border-b-0 border-blue-300 bg-white text-blue-700 shadow-sm'
                                : 'border-transparent text-gray-600 hover:bg-white/70'
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                      <div className="flex-1 rounded border border-dashed border-gray-300 bg-white/70 px-3 py-2 text-sm text-gray-600">
                        管理職がセットしたメモ・スクリプトがここに表示されます。（読み取り優先）
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col">
                      {/* 自分で書くタブ（最大4枚、＋で追加） */}
                      <div className="mb-2 flex flex-wrap items-center gap-1 border-b border-gray-200 pb-1 text-xs">
                        {selfTabs.map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveSelfTabId(tab.id)}
                            className={`rounded-t border px-2.5 py-1 ${
                              activeSelfTabId === tab.id
                                ? 'border-b-0 border-blue-300 bg-white text-blue-700 shadow-sm'
                                : 'border-transparent text-gray-600 hover:bg-white/70'
                            }`}
                          >
                            {tab.title}
                          </button>
                        ))}
                        {selfTabs.length < 4 && (
                          <button
                            type="button"
                            onClick={addSelfTab}
                            className="inline-flex items-center justify-center rounded-full border border-dashed border-gray-400 px-2 py-0.5 text-xs text-gray-600 hover:bg-white"
                            aria-label="自分で書くタブを追加"
                          >
                            ＋
                          </button>
                        )}
                      </div>
                      <div className="flex-1">
                        {(() => {
                          const activeTab =
                            selfTabs.find((t) => t.id === activeSelfTabId) ?? selfTabs[0]
                          if (!activeTab) {
                            return (
                              <p className="text-sm text-gray-500">
                                自分で書くタブがありません。＋ボタンで追加してください。
                              </p>
                            )
                          }
                          return (
                            <textarea
                              value={activeTab.content}
                              onChange={(e) => updateSelfTabContent(activeTab.id, e.target.value)}
                              placeholder="自分で書くメモを入力..."
                              className="min-h-[180px] w-full resize-y rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              rows={8}
                            />
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="shrink-0 space-y-6">
            <div className="rounded-md border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">案件ルール</h2>
              <p className="mt-2 text-sm text-gray-500">管理職がPJ（プロジェクト）ごとにセットするルール・スクリプト・判定基準を表示します。</p>
              <div className="mt-4 min-h-[200px] rounded border border-dashed border-gray-300 bg-gray-50/50 p-4">
                <p className="text-sm text-gray-500">PJを選択すると、そのPJ用に設定されたルールが表示されます。</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'kpi' && (
          <div className="shrink-0 space-y-6">
            <div className="rounded-md border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">KPI</h2>
              <p className="mt-2 text-sm text-gray-500">PJごとに全体・Team・個人のKPIを表示。グラフで比較できます。</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {KPI_SCOPES.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setKpiScope(key)}
                    className={`rounded px-3 py-1.5 text-sm font-medium ${
                      kpiScope === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-4 min-h-[280px] rounded border border-gray-200 bg-gray-50/50 p-4">
                <p className="text-sm text-gray-600">
                  {kpiScope === 'all' && 'PJ全体のKPI（達成率・件数・推移など）をグラフで表示します。'}
                  {kpiScope === 'team' && 'Team単位のKPIをグラフで比較表示します。'}
                  {kpiScope === 'individual' && '個人・PJ全員のKPIをグラフで比較表示します。'}
                </p>
                <div className="mt-4 flex h-48 items-center justify-center rounded border border-dashed border-gray-300 bg-white text-gray-400">
                  グラフエリア（将来実装）
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'daily' && (
          <div className="shrink-0 space-y-6">
            <div className="rounded-md border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">日報</h2>
              <p className="mt-2 text-sm text-gray-500">日次の活動・架電サマリ・メモを記録・確認します。</p>
              <div className="mt-4 min-h-[200px] rounded border border-dashed border-gray-300 bg-gray-50/50 p-4">
                <p className="text-sm text-gray-500">日報の入力・一覧・PJ別フィルタをここに表示します。</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'memo-c' && (
          <div className="shrink-0">
            <NotionBlockEditor
              title={activeLabel}
              storageKey={`memo-c:${searchParams.get('company') ?? 'default'}`}
            />
          </div>
        )}
      </div>
    </div>
  )
}
