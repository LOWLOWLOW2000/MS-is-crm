'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  distributeListItemsEven,
  fetchCallingLists,
  fetchListIndustryMasters,
  fetchListKpiByAssignee,
  fetchUsers,
  previewDistributeEvenMatch,
  recallListItems,
} from '@/lib/calling-api'
import type { ListIndustryMasterRow } from '@/lib/types'
import {
  CITY_OPTION_ALL,
  JAPAN_PREFECTURES,
  citiesForPrefecture,
} from '@/lib/data/japan-regions'

const KPI_STATUS_KEYS = ['unstarted', 'calling', 'done', 'excluded'] as const

const KPI_STATUS_LABEL: Record<(typeof KPI_STATUS_KEYS)[number], string> = {
  unstarted: '未着手',
  calling: '架電中',
  done: '完了',
  excluded: '除外',
}

type CallProgress = 'unstarted' | 'contacted' | 'any'

export function DistributeClient({ initialListId }: { initialListId?: string }) {
  const { data: session } = useSession()
  const accessToken = session?.accessToken ?? ''

  const [listsLoading, setListsLoading] = useState(false)
  const [lists, setLists] = useState<{ id: string; name: string; itemCount: number }[]>([])
  const [selectedListId, setSelectedListId] = useState('')
  const [listModalOpen, setListModalOpen] = useState(false)

  const [mastersLoading, setMastersLoading] = useState(false)
  const [industryMasters, setIndustryMasters] = useState<ListIndustryMasterRow[]>([])
  const [industryName, setIndustryName] = useState('')

  const [prefecture, setPrefecture] = useState('')
  const [city, setCity] = useState(CITY_OPTION_ALL)

  const [callProgress, setCallProgress] = useState<CallProgress>('unstarted')
  const [aiA, setAiA] = useState(false)
  const [aiB, setAiB] = useState(false)
  const [aiC, setAiC] = useState(false)

  const [usersLoading, setUsersLoading] = useState(false)
  const [users, setUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])

  const [actionLoading, setActionLoading] = useState(false)
  const [lastMessage, setLastMessage] = useState<string>('')

  const [kpiLoading, setKpiLoading] = useState(false)
  const [kpiRows, setKpiRows] = useState<{ assigneeUserId: string | null; status: string; count: number }[]>([])

  const [previewLoading, setPreviewLoading] = useState(false)
  const [matchCount, setMatchCount] = useState<number | null>(null)

  const cityOptions = useMemo(() => citiesForPrefecture(prefecture), [prefecture])

  useEffect(() => {
    setCity(CITY_OPTION_ALL)
  }, [prefecture])

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

  const selectedUsersLabel = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.name || u.email]))
    return selectedUserIds.map((id) => map.get(id) ?? id).join(', ')
  }, [selectedUserIds, users])

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

  const selectedListLabel = useMemo(() => {
    const hit = lists.find((l) => l.id === selectedListId)
    return hit ? `${hit.name}` : ''
  }, [lists, selectedListId])

  const selectedListMeta = useMemo(() => {
    const hit = lists.find((l) => l.id === selectedListId)
    return hit ?? null
  }, [lists, selectedListId])

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
    const cityContains =
      cityRaw && cityRaw !== CITY_OPTION_ALL ? cityRaw : undefined
    const industryTagContains = industryName.trim() || undefined
    return {
      addressContains,
      cityContains,
      industryTagContains,
      callProgress,
      aiTiers: aiTiers.length > 0 ? aiTiers : undefined,
    }
  }, [prefecture, city, industryName, callProgress, aiTiers])

  useEffect(() => {
    if (!accessToken) return
    const run = async () => {
      setListsLoading(true)
      try {
        const next = await fetchCallingLists(accessToken)
        setLists(next.map((l) => ({ id: l.id, name: l.name, itemCount: l.itemCount })))
        if (initialListId && next.some((l) => l.id === initialListId)) {
          setSelectedListId(initialListId)
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
        setUsers(next.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })))
      } catch (e) {
        setLastMessage((e as Error).message)
      } finally {
        setUsersLoading(false)
      }
    }
    void run()
  }, [accessToken])

  useEffect(() => {
    if (!listModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setListModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [listModalOpen])

  const refreshKpi = async () => {
    if (!accessToken || !selectedListId) return
    setKpiLoading(true)
    try {
      const rows = await fetchListKpiByAssignee(accessToken, selectedListId)
      setKpiRows(rows)
    } catch (e) {
      setLastMessage((e as Error).message)
    } finally {
      setKpiLoading(false)
    }
  }

  const resetPreview = useCallback(() => {
    setMatchCount(null)
  }, [])

  const handlePreviewMatch = async () => {
    if (!accessToken) return
    if (!selectedListId) {
      setLastMessage('リストを選択してください')
      return
    }
    setPreviewLoading(true)
    try {
      const result = await previewDistributeEvenMatch(accessToken, selectedListId, filterPayload)
      setMatchCount(result.matchCount)
      const progLabel =
        callProgress === 'unstarted'
          ? '未架電（未着手）'
          : callProgress === 'contacted'
            ? '架電済み（架電中・完了）'
            : 'すべての進捗'
      setLastMessage(`条件に一致する件数: ${result.matchCount}件（${progLabel}）`)
    } catch (e) {
      setLastMessage((e as Error).message)
      setMatchCount(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleDistributeEven = async () => {
    if (!accessToken) return
    if (!selectedListId) {
      setLastMessage('リストを選択してください')
      return
    }
    if (selectedUserIds.length === 0) {
      setLastMessage('配布先（User.id）を選択してください')
      return
    }
    if (callProgress !== 'unstarted') {
      const ok = window.confirm(
        '未着手以外を配布対象にしています。既存の割当が上書きされる場合があります。続行しますか？',
      )
      if (!ok) return
    }
    setActionLoading(true)
    try {
      const result = await distributeListItemsEven(accessToken, selectedListId, {
        assigneeUserIds: selectedUserIds,
        ...filterPayload,
      })
      setLastMessage(`均等配布しました: ${result.updatedCount}件`)
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
    if (!selectedListId) {
      setLastMessage('リストを選択してください')
      return
    }
    setActionLoading(true)
    try {
      const result = await recallListItems(accessToken, selectedListId, { mode })
      setLastMessage(`引き上げしました: ${result.updatedCount}件（mode=${mode}）`)
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
    !!filterPayload.industryTagContains ||
    callProgress !== 'unstarted' ||
    (filterPayload.aiTiers?.length ?? 0) > 0

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">担当へ配布</h1>
      <p className="mt-2 text-sm text-gray-600">
        格納した架電リストの<strong className="font-semibold">どれを対象にするか</strong>
        を選び、上の条件で絞り込んだうえで、ISメンバーへ
        <strong className="font-semibold">均等配布</strong>・<strong className="font-semibold">引き上げ</strong>
        （割当解除）し、進捗は下のKPIで確認します。1件＝リスト内の1社（明細）です。
      </p>

      {lastMessage && (
        <div className="mt-4 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {lastMessage}
        </div>
      )}

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">条件付き均等配布</h2>
        <p className="mt-1 text-xs text-gray-500">
          都道府県・市区は住所への部分一致、業種はマスタ名で部分一致です。住所の表記ゆれがある場合は結果がずれることがあります。未架電＝ListItem
          status が未着手のみ。架電済み＝架電中・完了。
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs font-medium text-gray-700">
            都道府県
            <select
              value={prefecture}
              onChange={(e) => {
                setPrefecture(e.target.value)
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
          <label className="block text-xs font-medium text-gray-700">
            業種（中カテゴリ＝マスタ名）
            <select
              value={industryName}
              onChange={(e) => {
                setIndustryName(e.target.value)
                resetPreview()
              }}
              disabled={mastersLoading}
              className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">（指定なし）</option>
              {industryByGroup.map(([group, rows]) => (
                <optgroup key={group} label={group}>
                  {rows.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-gray-700">
            未架電 / 架電済み（ListItem ステータス）
            <select
              value={callProgress}
              onChange={(e) => {
                setCallProgress(e.target.value as CallProgress)
                resetPreview()
              }}
              className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="unstarted">未架電（未着手のみ）</option>
              <option value="contacted">架電済み（架電中・完了）</option>
              <option value="any">進捗すべて</option>
            </select>
          </label>
          <fieldset className="text-xs font-medium text-gray-700">
            <legend className="mb-1">AIリスト判定（A〜C、未チェック＝絞り込みなし）</legend>
            <div className="flex flex-wrap gap-3 pt-1">
              <label className="flex items-center gap-1.5 font-normal">
                <input
                  type="checkbox"
                  checked={aiA}
                  onChange={(e) => {
                    setAiA(e.target.checked)
                    resetPreview()
                  }}
                  className="rounded border-gray-300"
                />
                A
              </label>
              <label className="flex items-center gap-1.5 font-normal">
                <input
                  type="checkbox"
                  checked={aiB}
                  onChange={(e) => {
                    setAiB(e.target.checked)
                    resetPreview()
                  }}
                  className="rounded border-gray-300"
                />
                B
              </label>
              <label className="flex items-center gap-1.5 font-normal">
                <input
                  type="checkbox"
                  checked={aiC}
                  onChange={(e) => {
                    setAiC(e.target.checked)
                    resetPreview()
                  }}
                  className="rounded border-gray-300"
                />
                C
              </label>
            </div>
          </fieldset>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePreviewMatch}
            disabled={previewLoading || !selectedListId}
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
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            CSV格納などで登録済みの「架電リスト」から、今回操作するリストを1つ選びます。名前（例:
            CSVリスト-日付）は取り込み時のリスト名です。
          </p>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => setListModalOpen(true)}
              disabled={listsLoading}
              className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60"
            >
              {listsLoading
                ? '読み込み中...'
                : selectedListId
                  ? `${selectedListLabel || '（無題）'}（明細 ${selectedListMeta?.itemCount ?? '—'} 件）`
                  : 'リストを選ぶ'}
            </button>
            <div className="text-[11px] text-gray-600">
              テナント内のリスト: <span className="tabular-nums font-medium text-gray-800">{lists.length}</span> 件
              {selectedListId && selectedListMeta ? (
                <span className="mt-1 block text-gray-500">
                  選択中の内部ID（問い合わせ・ログ用・通常は不要）:{' '}
                  <code className="rounded bg-slate-100 px-1 text-[10px] text-slate-700">{selectedListId}</code>
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">配布先（User.id）</h2>
          <div className="mt-3 max-h-[260px] overflow-auto rounded border border-gray-200">
            {usersLoading ? (
              <div className="p-3 text-sm text-gray-500">読み込み中...</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {users.map((u) => {
                  const checked = selectedUserIds.includes(u.id)
                  return (
                    <li key={u.id} className="flex items-start gap-2 p-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedUserIds((prev) =>
                            e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id),
                          )
                        }}
                        className="mt-1 h-4 w-4 rounded border-gray-300"
                        aria-label={`選択 ${u.name}`}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900">{u.name || u.email}</div>
                        <div className="text-[11px] text-gray-500">
                          {u.email} / {u.role} / {u.id}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="mt-2 text-[11px] text-gray-600">選択中: {selectedUsersLabel || '—'}</div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">操作</h2>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={handleDistributeEven}
              disabled={actionLoading}
              className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {hasFilters ? '条件付き均等配布' : '均等配布（条件なし）'}
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleRecall('unstartedOnly')}
                disabled={actionLoading}
                className="rounded border border-gray-300 bg-white px-2 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                未着手引上げ
              </button>
              <button
                type="button"
                onClick={() => handleRecall('callingOnly')}
                disabled={actionLoading}
                className="rounded border border-gray-300 bg-white px-2 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                架電中引上げ
              </button>
              <button
                type="button"
                onClick={() => handleRecall('all')}
                disabled={actionLoading}
                className="rounded border border-gray-300 bg-white px-2 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                全部引上げ
              </button>
            </div>
            <button
              type="button"
              onClick={refreshKpi}
              disabled={kpiLoading || !selectedListId}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              KPI更新
            </button>
          </div>
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
                    KPI未取得（「配布の対象リスト」を選び「KPI更新」を押してください）
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

      {listModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setListModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="list-picker-title"
            className="flex max-h-[min(28rem,75vh)] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && setListModalOpen(false)}
          >
            <div
              id="list-picker-title"
              className="shrink-0 border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900"
            >
              架電リストをタップして選択
            </div>
            <p className="border-b border-gray-100 px-4 py-2 text-[11px] text-gray-500">
              一覧は多い場合スクロールできます。各行の件数はリスト内の企業（明細）数です。
            </p>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {lists.map((l) => (
                <li key={l.id} className="border-b border-gray-100 last:border-0">
                  <button
                    type="button"
                    title={`内部ID: ${l.id}`}
                    className="w-full px-4 py-3 text-left text-sm text-gray-800 hover:bg-amber-50"
                    onClick={() => {
                      setSelectedListId(l.id)
                      setListModalOpen(false)
                      resetPreview()
                    }}
                  >
                    <span className="font-medium">{l.name}</span>
                    <span className="mt-0.5 block text-[11px] text-gray-500">明細 {l.itemCount} 件</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="shrink-0 border-t border-gray-200 p-2">
              <button
                type="button"
                className="w-full rounded border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setListModalOpen(false)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
