'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  distributeListItemsEven,
  distributeListItemsTargetCounts,
  fetchCallingLists,
  fetchListIndustryMasters,
  fetchListKpiByAssignee,
  fetchUsers,
  previewDistributeEvenMatch,
  recallListItems,
  type UserListItem,
} from '@/lib/calling-api'
import type { ListIndustryMasterRow } from '@/lib/types'
import {
  CITY_OPTION_ALL,
  JAPAN_PREFECTURES,
  citiesForPrefecture,
} from '@/lib/data/japan-regions'
import { CALLING_RESULT_VALUES } from '@/lib/calling-result-canonical'

const KPI_STATUS_KEYS = ['unstarted', 'calling', 'done', 'excluded'] as const

const KPI_STATUS_LABEL: Record<(typeof KPI_STATUS_KEYS)[number], string> = {
  unstarted: '未着手',
  calling: '架電中',
  done: '完了',
  excluded: '除外',
}

/**
 * プロフ画像未設定時の簡易イニシャル表示
 * （配布先リストで写真を左端に出す）
 */
const initialsFromName = (name: string): string => {
  const t = name.trim()
  if (t.length === 0) return '?'
  const parts = t.split(/[\s　]+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  }
  return t.slice(0, 2).toUpperCase()
}

const STATUS_OPTIONS = CALLING_RESULT_VALUES

export function DistributeClient({ initialListId }: { initialListId?: string }) {
  const { data: session } = useSession()
  const accessToken = session?.accessToken ?? ''

  const [listsLoading, setListsLoading] = useState(false)
  const [lists, setLists] = useState<{ id: string; name: string; itemCount: number }[]>([])
  /** 配布・プレビュー・回収・KPIの対象（複数可） */
  const [selectedListIds, setSelectedListIds] = useState<string[]>([])

  const [mastersLoading, setMastersLoading] = useState(false)
  const [industryMasters, setIndustryMasters] = useState<ListIndustryMasterRow[]>([])
  /** 業種マスタ名（複数選択・いずれかに industryTag が部分一致） */
  const [selectedIndustryNames, setSelectedIndustryNames] = useState<string[]>([])
  const [industrySearch, setIndustrySearch] = useState('')

  const [prefecture, setPrefecture] = useState('')
  const [city, setCity] = useState(CITY_OPTION_ALL)

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [aiA, setAiA] = useState(false)
  const [aiB, setAiB] = useState(false)
  const [aiC, setAiC] = useState(false)

  type DistributeMode = 'even' | 'target'
  const [distributeMode, setDistributeMode] = useState<DistributeMode>('even')

  const [usersLoading, setUsersLoading] = useState(false)
  const [users, setUsers] = useState<UserListItem[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [targetCountsByUserId, setTargetCountsByUserId] = useState<Record<string, number>>({})

  const [actionLoading, setActionLoading] = useState(false)
  const [lastMessage, setLastMessage] = useState<string>('')

  const [kpiLoading, setKpiLoading] = useState(false)
  const [kpiRows, setKpiRows] = useState<{ assigneeUserId: string | null; status: string; count: number }[]>([])

  const [previewLoading, setPreviewLoading] = useState(false)
  const [matchCount, setMatchCount] = useState<number | null>(null)

  const cityOptions = useMemo(() => citiesForPrefecture(prefecture), [prefecture])

  /** プレビュー結果メッセージ用（API に送る住所条件と同じ解釈） */
  const addressFilterSummaryForMessage = useMemo(() => {
    const pref = prefecture.trim()
    const cityRaw = city.trim()
    const cityActive =
      cityRaw.length > 0 &&
      cityRaw !== CITY_OPTION_ALL &&
      cityOptions.includes(cityRaw)
        ? cityRaw
        : null
    if (!pref && !cityActive) return '住所未指定'
    if (pref && cityActive) return `${pref}・${cityActive}`
    if (pref) return `${pref}（市区町村: 全域）`
    return cityActive ?? '住所未指定'
  }, [prefecture, city, cityOptions])

  const industryByGroup = useMemo(() => {
    const map = new Map<string, ListIndustryMasterRow[]>()
    for (const m of industryMasters) {
      const g = m.groupLabel ?? 'その他'
      const list = map.get(g) ?? []
      list.push(m)
      map.set(g, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'ja'))
  }, [industryMasters])

  const filteredIndustryByGroup = useMemo(() => {
    const q = industrySearch.trim().toLowerCase()
    if (!q) return industryByGroup
    return industryByGroup
      .map(([group, rows]) => [group, rows.filter((m) => m.name.toLowerCase().includes(q))] as const)
      .filter(([, rows]) => rows.length > 0)
  }, [industryByGroup, industrySearch])

  const selectedUsersLabel = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.name || u.email]))
    return selectedUserIds.map((id) => map.get(id) ?? id).join(', ')
  }, [selectedUserIds, users])

  /** 均等配布は配布先パネルを使わず、取得済みメンバー全員へ割り当てる */
  const assigneeUserIdsForEven = useMemo(() => users.map((u) => u.id), [users])

  const totalTargetAllocationCount = useMemo(() => {
    return selectedUserIds.reduce((acc, id) => acc + (targetCountsByUserId[id] ?? 0), 0)
  }, [selectedUserIds, targetCountsByUserId])

  const kpiMatrixRows = useMemo(() => {
    const byAssignee = new Map<string | null, Record<string, number>>()
    for (const row of kpiRows) {
      const key = row.assigneeUserId
      if (!byAssignee.has(key)) {
        byAssignee.set(key, {})
      }
      const rec = byAssignee.get(key) as Record<string, number>
      rec[row.status] = (rec[row.status] ?? 0) + row.count
    }
    const rows = Array.from(byAssignee.entries()).map(([assigneeUserId, counts]) => {
      const sub = KPI_STATUS_KEYS.reduce((acc, s) => acc + (counts[s] ?? 0), 0)
      return { assigneeUserId, counts, total: sub }
    })
    rows.sort((a, b) => {
      if (a.assigneeUserId === null && b.assigneeUserId !== null) return -1
      if (a.assigneeUserId !== null && b.assigneeUserId === null) return 1
      return b.total - a.total
    })
    return rows
  }, [kpiRows])

  const userLabelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of users) {
      m.set(u.id, u.name || u.email)
    }
    return m
  }, [users])

  /** `リスト名（〇〇件）` 形式の1行表記 */
  const formatListLine = (l: { name: string; itemCount: number }) =>
    `${l.name || '（無題）'}（${l.itemCount}件）`

  const selectedListsDisplay = useMemo(() => {
    return selectedListIds
      .map((id) => lists.find((l) => l.id === id))
      .filter((x): x is { id: string; name: string; itemCount: number } => Boolean(x))
  }, [lists, selectedListIds])

  /** トリガー用ボタンに載せる短文（複数時は件数サマリ） */
  const targetListButtonLabel = useMemo(() => {
    if (selectedListsDisplay.length === 0) return ''
    if (selectedListsDisplay.length === 1) return formatListLine(selectedListsDisplay[0])
    return `選択中 ${selectedListsDisplay.length} リスト`
  }, [selectedListsDisplay])

  const aiTiers = useMemo((): ('A' | 'B' | 'C')[] => {
    const t: ('A' | 'B' | 'C')[] = []
    if (aiA) t.push('A')
    if (aiB) t.push('B')
    if (aiC) t.push('C')
    return t
  }, [aiA, aiB, aiC])

  const filterPayload = useMemo(() => {
    const addressContains = prefecture.trim() || undefined
    const cityRaw = city.trim()
    /** 県変更直後のズレで「別県の市区」が残らないよう、現在のプルダウンに存在する値だけ送る */
    const cityInCurrentOptions =
      cityRaw.length > 0 &&
      cityRaw !== CITY_OPTION_ALL &&
      cityOptions.includes(cityRaw)
    const cityContains = cityInCurrentOptions ? cityRaw : undefined
    return {
      addressContains,
      cityContains,
      industryNames: selectedIndustryNames.length > 0 ? selectedIndustryNames : undefined,
      statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      aiTiers: aiTiers.length > 0 ? aiTiers : undefined,
    }
  }, [prefecture, city, cityOptions, selectedIndustryNames, selectedStatuses, aiTiers])

  useEffect(() => {
    if (!accessToken) return
    const run = async () => {
      setListsLoading(true)
      try {
        const next = await fetchCallingLists(accessToken)
        setLists(next.map((l) => ({ id: l.id, name: l.name, itemCount: l.itemCount })))
        if (initialListId && next.some((l) => l.id === initialListId)) {
          setSelectedListIds([initialListId])
        }
      } catch (e) {
        setLastMessage((e as Error).message)
      } finally {
        setListsLoading(false)
      }
    }
    void run()
  }, [accessToken, initialListId])

  useEffect(() => {
    if (!accessToken) return
    const run = async () => {
      setMastersLoading(true)
      try {
        const next = await fetchListIndustryMasters(accessToken)
        setIndustryMasters(next)
      } catch (e) {
        setLastMessage((e as Error).message)
      } finally {
        setMastersLoading(false)
      }
    }
    void run()
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) return
    const run = async () => {
      setUsersLoading(true)
      try {
        const next = await fetchUsers(accessToken)
        setUsers(next)
      } catch (e) {
        setLastMessage((e as Error).message)
      } finally {
        setUsersLoading(false)
      }
    }
    void run()
  }, [accessToken])

  /** リスト再取得後、存在しないIDを選択から外す */
  useEffect(() => {
    setSelectedListIds((prev) => prev.filter((id) => lists.some((l) => l.id === id)))
  }, [lists])

  const refreshKpi = useCallback(async () => {
    if (!accessToken || selectedListIds.length === 0) {
      setKpiRows([])
      return
    }
    setKpiLoading(true)
    try {
      const merged = new Map<string, { assigneeUserId: string | null; status: string; count: number }>()
      for (const listId of selectedListIds) {
        const rows = await fetchListKpiByAssignee(accessToken, listId)
        for (const r of rows) {
          const key = `${r.assigneeUserId ?? '__null__'}\t${r.status}`
          const prev = merged.get(key)
          if (prev) {
            prev.count += r.count
          } else {
            merged.set(key, {
              assigneeUserId: r.assigneeUserId,
              status: r.status,
              count: r.count,
            })
          }
        }
      }
      setKpiRows(Array.from(merged.values()))
    } catch (e) {
      setLastMessage((e as Error).message)
    } finally {
      setKpiLoading(false)
    }
  }, [accessToken, selectedListIds])

  useEffect(() => {
    // リスト選択後に、KPI（割当×進捗ステータス）を自動反映する
    void refreshKpi()
  }, [refreshKpi])

  const resetPreview = useCallback(() => {
    setMatchCount(null)
  }, [])

  const toggleTargetList = (listId: string, checked: boolean) => {
    setSelectedListIds((prev) => {
      if (checked) return prev.includes(listId) ? prev : [...prev, listId]
      return prev.filter((x) => x !== listId)
    })
    resetPreview()
  }

  const selectAllTargetLists = () => {
    setSelectedListIds(lists.map((l) => l.id))
    resetPreview()
  }

  const clearTargetLists = () => {
    setSelectedListIds([])
    resetPreview()
  }

  const handlePreviewMatch = async () => {
    if (!accessToken) return
    if (selectedListIds.length === 0) {
      setLastMessage('リストを1件以上選択してください')
      return
    }
    setPreviewLoading(true)
    try {
      let total = 0
      for (const listId of selectedListIds) {
        const result = await previewDistributeEvenMatch(accessToken, listId, filterPayload)
        total += result.matchCount
      }
      setMatchCount(total)
      const statusLabel =
        selectedStatuses.length === 0 ? '架電結果指定なし' : selectedStatuses.join(' / ')
      setLastMessage(
        `条件に一致する件数（選択リスト合計）: ${total}件（住所: ${addressFilterSummaryForMessage}・${statusLabel}・${selectedListIds.length}リスト）`,
      )
    } catch (e) {
      setLastMessage((e as Error).message)
      setMatchCount(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleDistributeEven = async () => {
    if (!accessToken) return
    if (selectedListIds.length === 0) {
      setLastMessage('リストを1件以上選択してください')
      return
    }
    if (selectedUserIds.length === 0) {
      setLastMessage('配布先（User.id）を選択してください')
      return
    }
    if (selectedStatuses.length > 0) {
      const ok = window.confirm(
        '架電結果（★架電ルーム）で絞り込み配布します。既存の割当が上書きされる場合があります。続行しますか？',
      )
      if (!ok) return
    }
    setActionLoading(true)
    try {
      let totalUpdated = 0
      for (const listId of selectedListIds) {
        const result = await distributeListItemsEven(accessToken, listId, {
          assigneeUserIds: selectedUserIds,
          ...filterPayload,
        })
        totalUpdated += result.updatedCount
      }
      setLastMessage(
        `均等配布しました: 合計 ${totalUpdated}件（対象 ${selectedListIds.length} リスト）`,
      )
      setMatchCount(null)
      await refreshKpi()
    } catch (e) {
      setLastMessage((e as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDistributeTargetCounts = async () => {
    if (!accessToken) return
    if (selectedListIds.length === 0) {
      setLastMessage('リストを1件以上選択してください')
      return
    }
    if (selectedUserIds.length === 0) {
      setLastMessage('配布先（User.id）を選択してください')
      return
    }
    if (totalTargetAllocationCount <= 0) {
      setLastMessage('全員目標割当件数（目標件数合計）が 1以上になるように設定してください')
      return
    }

    if (selectedStatuses.length > 0) {
      const ok = window.confirm(
        '架電結果（★架電ルーム）で絞り込み配布します。既存の割当が上書きされる場合があります。続行しますか？',
      )
      if (!ok) return
    }

    const targetCounts = selectedUserIds.map((id) => targetCountsByUserId[id] ?? 0)
    setActionLoading(true)
    try {
      let totalUpdated = 0
      for (const listId of selectedListIds) {
        const result = await distributeListItemsTargetCounts(accessToken, listId, {
          assigneeUserIds: selectedUserIds,
          targetCounts,
          ...filterPayload,
        })
        totalUpdated += result.updatedCount
      }
      setLastMessage(
        `目標件数でメンバーにリスト割り振り（全員目標割当件数: ${totalTargetAllocationCount}）: 合計 ${totalUpdated}件（対象 ${selectedListIds.length} リスト）`,
      )
      setMatchCount(null)
      await refreshKpi()
    } catch (e) {
      setLastMessage((e as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRecall = async (mode: 'all' | 'unstartedOnly' | 'callingOnly') => {
    if (!accessToken) return
    if (selectedListIds.length === 0) {
      setLastMessage('リストを1件以上選択してください')
      return
    }
    setActionLoading(true)
    try {
      let totalUpdated = 0
      for (const listId of selectedListIds) {
        const result = await recallListItems(accessToken, listId, { mode })
        totalUpdated += result.updatedCount
      }
      setLastMessage(
        `引き上げしました: 合計 ${totalUpdated}件（mode=${mode}・対象 ${selectedListIds.length} リスト）`,
      )
      await refreshKpi()
    } catch (e) {
      setLastMessage((e as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  const hasFilters =
    !!filterPayload.addressContains ||
    !!filterPayload.cityContains ||
    (filterPayload.industryNames?.length ?? 0) > 0 ||
    (filterPayload.statuses?.length ?? 0) > 0 ||
    (filterPayload.aiTiers?.length ?? 0) > 0

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">リスト配布・管理</h1>
      <p className="mt-2 text-sm text-gray-600">
        1. PJに格納されているリストをチェックで選択（複数可）
        <br />
        2. リストの<strong className="font-semibold">配布方法</strong>を選択・リストの<strong className="font-semibold">回収方法</strong>を選択
        <br />
        3. 2で選んだ方法の<strong className="font-semibold">追加操作</strong>
        <br />
        終了
      </p>

      {lastMessage && (
        <div className="mt-4 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {lastMessage}
        </div>
      )}

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">条件付き均等配布</h2>
        <p className="mt-1 text-xs text-gray-500">
          都道府県・市区は住所への部分一致です。業種はマスタを複数選ぶと、
          <code className="rounded bg-slate-100 px-1 text-[10px]">ListItem.industryTag</code>
          がいずれかのマスタ名に部分一致する明細が対象になります。住所の表記ゆれがある場合は結果がずれることがあります。
        </p>

        <fieldset className="mt-3 rounded border border-gray-200 bg-white px-3 py-2">
          <legend className="px-1 text-xs font-semibold text-gray-700">
            都道府県・市区町村
          </legend>
          <div className="mt-1 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-gray-700">
              都道府県
              <select
                value={prefecture}
                onChange={(e) => {
                  const next = e.target.value
                  setPrefecture(next)
                  /** 県が変わったら市区を即リセット（useEffect だと1レンダー古い市区が filter に残る） */
                  setCity(CITY_OPTION_ALL)
                  resetPreview()
                }}
                className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">（指定なし）</option>
                {JAPAN_PREFECTURES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-700">
              市区町村（主要リスト）
              <select
                key={prefecture || 'none'}
                value={city}
                onChange={(e) => {
                  setCity(e.target.value)
                  resetPreview()
                }}
                disabled={!prefecture}
                className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
              >
                {cityOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            都道府県未選択時は市区町村は選べません。未指定＝住所で絞り込みなし（他の条件のみ）
          </div>
        </fieldset>

        <fieldset className="mt-3 rounded border border-gray-200 bg-white px-3 py-2">
          <legend className="px-1 text-xs font-semibold text-gray-700">
            業種（中カテゴリ＝マスタ名）
          </legend>
          <label className="mt-2 block text-[11px] font-medium text-gray-600">
            マスタ名で絞り込み（表示のみ）
            <input
              type="search"
              value={industrySearch}
              onChange={(e) => setIndustrySearch(e.target.value)}
              placeholder="例: 飲食"
              disabled={mastersLoading}
              className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <div className="mt-2 max-h-48 overflow-y-auto rounded border border-slate-200 bg-slate-50/80 p-2">
            {mastersLoading ? (
              <div className="text-xs text-gray-500">業種マスタ読み込み中...</div>
            ) : filteredIndustryByGroup.length === 0 ? (
              <div className="text-xs text-gray-500">該当するマスタがありません</div>
            ) : (
              filteredIndustryByGroup.map(([group, rows]) => (
                <div key={group} className="mb-3 last:mb-0">
                  <div className="mb-1 text-[11px] font-semibold text-slate-700">{group}</div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {rows.map((m) => {
                      const checked = selectedIndustryNames.includes(m.name)
                      return (
                        <label
                          key={m.id}
                          className="flex min-w-0 items-center gap-2 rounded border border-transparent px-1 py-0.5 text-xs font-medium text-gray-700 hover:bg-white"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const on = e.target.checked
                              setSelectedIndustryNames((prev) =>
                                on ? [...prev, m.name] : prev.filter((x) => x !== m.name),
                              )
                              resetPreview()
                            }}
                            className="h-4 w-4 shrink-0 rounded border-gray-300"
                          />
                          <span className="truncate" title={m.name}>
                            {m.name}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            未選択＝業種で絞り込みなし（他の条件のみ）
          </div>
        </fieldset>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <fieldset className="rounded border border-gray-200 bg-white px-3 py-2">
            <legend className="px-1 text-xs font-semibold text-gray-700">
              架電結果（★架電ルーム / ListItem.callingResult）
            </legend>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {STATUS_OPTIONS.map((s) => {
                const checked = selectedStatuses.includes(s)
                return (
                  <label key={s} className="flex items-center gap-2 text-xs font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const nextChecked = e.target.checked
                        setSelectedStatuses((prev) =>
                          nextChecked ? [...prev, s] : prev.filter((x) => x !== s),
                        )
                        resetPreview()
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="truncate" title={s}>
                      {s}
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="mt-1 text-[11px] text-gray-500">
              未選択＝架電結果で絞り込みなし（他の条件のみ）
            </div>
          </fieldset>
          <fieldset className="rounded border border-gray-200 bg-white px-3 py-2">
            <legend className="px-1 text-xs font-semibold text-gray-700">
              AIリスト判定（A〜C）
            </legend>
            <div className="mt-1 flex flex-wrap gap-3 pt-1 text-xs font-medium text-gray-700">
              <label className="flex items-center gap-2 font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={aiA}
                  onChange={(e) => {
                    setAiA(e.target.checked)
                    resetPreview()
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
                A
              </label>
              <label className="flex items-center gap-2 font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={aiB}
                  onChange={(e) => {
                    setAiB(e.target.checked)
                    resetPreview()
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
                B
              </label>
              <label className="flex items-center gap-2 font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={aiC}
                  onChange={(e) => {
                    setAiC(e.target.checked)
                    resetPreview()
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
                C
              </label>
            </div>
            <div className="mt-1 text-[11px] text-gray-500">
              未チェック＝AIティアで絞り込みなし（他の条件のみ）
            </div>
          </fieldset>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePreviewMatch}
            disabled={previewLoading || selectedListIds.length === 0}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
          >
            {previewLoading ? '確認中…' : '対象件数を確認'}
          </button>
          {matchCount !== null && (
            <span className="text-sm text-gray-700">
              一致: <span className="font-semibold tabular-nums">{matchCount}</span> 件
            </span>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">配布の対象リスト</h2>
          <p className="mt-2 text-xs text-gray-600">
            チェックで複数選択できます。プレビュー・配布・回収・KPIは<strong className="font-semibold">選択した全リスト</strong>に対して実行されます（KPIは合算表示）。
          </p>
          <div className="mt-2 text-xs text-gray-700">
            新規のリストは{' '}
            <Link href="/director/calling-lists/import" className="font-semibold text-blue-600 hover:underline">
              リスト格納
            </Link>
            から追加できます。
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectAllTargetLists}
              disabled={listsLoading || lists.length === 0}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              全選択
            </button>
            <button
              type="button"
              onClick={clearTargetLists}
              disabled={selectedListIds.length === 0}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              全解除
            </button>
          </div>
          <div className="mt-2 max-h-56 overflow-y-auto rounded border border-gray-200 bg-slate-50/50">
            {listsLoading ? (
              <div className="p-3 text-xs text-gray-500">読み込み中...</div>
            ) : lists.length === 0 ? (
              <div className="p-3 text-xs text-gray-500">リストがありません</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {lists.map((l) => {
                  const checked = selectedListIds.includes(l.id)
                  return (
                    <li key={l.id}>
                      <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-amber-50/80">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleTargetList(l.id, e.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
                          aria-label={`対象にする ${formatListLine(l)}`}
                        />
                        <span className="min-w-0 flex-1 text-sm font-medium text-gray-900">
                          {formatListLine(l)}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="mt-2 text-base text-gray-700">
            テナント内{' '}
            <span className="font-semibold tabular-nums text-blue-600">{lists.length}</span> 件 / 選択{' '}
            <span className="font-semibold tabular-nums text-blue-600">{selectedListIds.length}</span> 件
            {targetListButtonLabel && selectedListsDisplay.length > 1 ? (
              <span className="mt-1 block text-gray-500">{targetListButtonLabel}</span>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">配布方法</h2>
          <div className="mt-3 space-y-2">
            <fieldset className="text-xs font-medium text-gray-700">
              <legend className="mb-1">配布方法</legend>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 font-normal">
                  <input
                    type="radio"
                    name="distribute-mode"
                    checked={distributeMode === 'even'}
                    onChange={() => setDistributeMode('even')}
                    className="rounded border-gray-300"
                  />
                  均等割り付け
                </label>
                <label className="flex items-center gap-2 font-normal">
                  <input
                    type="radio"
                    name="distribute-mode"
                    checked={distributeMode === 'target'}
                    onChange={() => setDistributeMode('target')}
                    className="rounded border-gray-300"
                  />
                  目標件数でメンバーにリスト割り振り
                </label>
              </div>
            </fieldset>

            {distributeMode === 'even' ? (
              <button
                type="button"
                onClick={handleDistributeEven}
                disabled={actionLoading || selectedListIds.length === 0}
                className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {hasFilters ? '条件付き均等配布' : '均等配布（条件なし）'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDistributeTargetCounts}
                disabled={
                  actionLoading ||
                  selectedListIds.length === 0 ||
                  selectedUserIds.length === 0 ||
                  totalTargetAllocationCount <= 0
                }
                className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {hasFilters ? '条件付き目標件数で割り振り' : '目標件数で割り振り（条件なし）'}
              </button>
            )}

            <div className="pt-1 text-xs font-semibold text-gray-800">回収方法</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleRecall('unstartedOnly')}
                disabled={actionLoading || selectedListIds.length === 0}
                className="rounded border border-gray-300 bg-white px-2 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                未着手引上げ
              </button>
              <button
                type="button"
                onClick={() => handleRecall('callingOnly')}
                disabled={actionLoading || selectedListIds.length === 0}
                className="rounded border border-gray-300 bg-white px-2 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                架電中引上げ
              </button>
              <button
                type="button"
                onClick={() => handleRecall('all')}
                disabled={actionLoading || selectedListIds.length === 0}
                className="rounded border border-gray-300 bg-white px-2 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                全部引上げ
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">配布先（User.id）</h2>
          <div className="mt-1 text-base text-gray-700">
            テナント内{' '}
            <span className="font-semibold tabular-nums text-blue-600">{users.length}</span> 件 / 選択{' '}
            <span className="font-semibold tabular-nums text-blue-600">{selectedUserIds.length}</span> 件
          </div>
          <div className="mt-3 max-h-[260px] overflow-auto rounded border border-gray-200">
            {usersLoading ? (
              <div className="p-3 text-sm text-gray-500">読み込み中...</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {users.map((u) => {
                  const checked = selectedUserIds.includes(u.id)
                  const displayName = u.name || u.email || u.id
                  const ringClass = checked ? 'ring-sky-300' : 'ring-gray-200'
                  const bgGradient = checked
                    ? 'from-sky-200 to-sky-300'
                    : 'from-slate-200 to-slate-300'
                  return (
                    <li key={u.id} className="flex items-start gap-2 p-3">
                      {/* 写真を左端表示 */}
                      <div
                        className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-br ring-1 ${ringClass} ${bgGradient}`}
                        title={displayName}
                      >
                        {u.profileImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.profileImageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-700">
                            {initialsFromName(displayName)}
                          </span>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const nextChecked = e.target.checked
                          setSelectedUserIds((prev) =>
                            nextChecked ? [...prev, u.id] : prev.filter((x) => x !== u.id),
                          )
                          setTargetCountsByUserId((prev) => {
                            if (!nextChecked) {
                              const { [u.id]: _removed, ...rest } = prev
                              return rest
                            }
                            return { ...prev, [u.id]: prev[u.id] ?? 1 }
                          })
                        }}
                        className="mt-1 h-4 w-4 rounded border-gray-300"
                        aria-label={`選択 ${displayName}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {displayName}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {u.role} / {u.id}
                        </div>
                      </div>
                      {checked && distributeMode === 'target' ? (
                        <div className="ml-auto flex flex-col items-end gap-1">
                          <label className="text-[11px] font-medium text-gray-600">
                            目標割当件数（メンバーへ割り振り）
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={targetCountsByUserId[u.id] ?? 0}
                            onChange={(e) => {
                              const raw = e.target.value
                              const next = raw === '' ? 0 : Math.max(0, Math.floor(Number(raw)))
                              setTargetCountsByUserId((prev) => ({ ...prev, [u.id]: next }))
                            }}
                            className="w-28 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-right"
                          />
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="mt-2 text-[11px] text-gray-600">選択中: {selectedUsersLabel || '—'}</div>
          {distributeMode === 'target' ? (
            <div className="mt-1 text-[11px] text-gray-600">
              全員目標割当件数（メンバー別合計）: <span className="font-semibold tabular-nums">{totalTargetAllocationCount}</span>
            </div>
          ) : null}
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">リスト×担当 KPI（マトリクス）</h2>
          <div className="text-[11px] text-gray-500">約20名分が縦スクロールで一覧しやすい表示</div>
        </div>
        <div className="mt-3 max-h-[28rem] overflow-auto rounded border border-gray-200">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
              <tr>
                <th className="border-b border-gray-200 px-2 py-2 font-semibold text-gray-900">担当</th>
                {KPI_STATUS_KEYS.map((s) => (
                  <th
                    key={s}
                    className="border-b border-gray-200 px-2 py-2 text-center font-semibold text-gray-800"
                  >
                    {KPI_STATUS_LABEL[s]}
                  </th>
                ))}
                <th className="border-b border-gray-200 px-2 py-2 text-center font-semibold text-gray-900">計</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {kpiLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                    読み込み中...
                  </td>
                </tr>
              ) : kpiMatrixRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                    KPI未取得（「配布の対象リスト」で1件以上チェックすると自動で取得・複数は合算）
                  </td>
                </tr>
              ) : (
                kpiMatrixRows.map((row) => {
                  const label =
                    row.assigneeUserId === null
                      ? '未割当'
                      : userLabelById.get(row.assigneeUserId) ?? row.assigneeUserId
                  return (
                    <tr key={row.assigneeUserId ?? 'unassigned'} className="hover:bg-slate-50/80">
                      <td className="max-w-[10rem] truncate px-2 py-1.5 font-medium text-gray-900" title={label}>
                        {label}
                      </td>
                      {KPI_STATUS_KEYS.map((s) => (
                        <td key={s} className="px-2 py-1.5 text-center tabular-nums text-gray-800">
                          {row.counts[s] ?? 0}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center font-semibold tabular-nums text-gray-900">
                        {row.total}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}
