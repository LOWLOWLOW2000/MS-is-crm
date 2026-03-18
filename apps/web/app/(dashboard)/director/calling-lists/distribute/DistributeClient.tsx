'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  distributeListItemsEven,
  fetchCallingLists,
  fetchListKpiByAssignee,
  fetchUsers,
  recallListItems,
} from '@/lib/calling-api'

export function DistributeClient({ initialListId }: { initialListId?: string }) {
  const { data: session } = useSession()
  const accessToken = session?.accessToken ?? ''

  const [listsLoading, setListsLoading] = useState(false)
  const [lists, setLists] = useState<{ id: string; name: string }[]>([])
  const [selectedListId, setSelectedListId] = useState('')

  const [usersLoading, setUsersLoading] = useState(false)
  const [users, setUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])

  const [actionLoading, setActionLoading] = useState(false)
  const [lastMessage, setLastMessage] = useState<string>('')

  const [kpiLoading, setKpiLoading] = useState(false)
  const [kpiRows, setKpiRows] = useState<{ assigneeUserId: string | null; status: string; count: number }[]>([])

  const selectedUsersLabel = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.name || u.email]))
    return selectedUserIds.map((id) => map.get(id) ?? id).join(', ')
  }, [selectedUserIds, users])

  useEffect(() => {
    if (!accessToken) return
    const run = async () => {
      setListsLoading(true)
      try {
        const next = await fetchCallingLists(accessToken)
        setLists(next.map((l) => ({ id: l.id, name: l.name })))
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
    setActionLoading(true)
    try {
      const result = await distributeListItemsEven(accessToken, selectedListId, { assigneeUserIds: selectedUserIds })
      setLastMessage(`均等配布しました: ${result.updatedCount}件`)
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

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">担当へ配布</h1>
      <p className="mt-2 text-sm text-gray-600">
        リスト内の企業（ListItem）単位で、担当（User.id）へ配布・引き上げ・KPI確認を行います。
      </p>

      {lastMessage && (
        <div className="mt-4 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {lastMessage}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">リスト選択</h2>
          <div className="mt-3">
            <select
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              aria-label="対象リスト"
              disabled={listsLoading}
            >
              <option value="">（選択してください）</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}（{l.id}）
                </option>
              ))}
            </select>
            <div className="mt-2 text-[11px] text-gray-500">
              {listsLoading ? '読み込み中...' : `リスト数: ${lists.length}`}
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
                            e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id)
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
              均等配布（unstartedのみ）
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">リスト×担当 KPI（簡易）</h2>
          <div className="text-[11px] text-gray-500">statusごとの件数</div>
        </div>
        <div className="mt-3 overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 font-medium text-gray-900">assigneeUserId</th>
                <th className="px-3 py-2 font-medium text-gray-900">status</th>
                <th className="px-3 py-2 font-medium text-gray-900">count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {kpiLoading ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-gray-500">
                    読み込み中...
                  </td>
                </tr>
              ) : kpiRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-gray-500">
                    KPI未取得（リスト選択→KPI更新）
                  </td>
                </tr>
              ) : (
                kpiRows.map((r, idx) => (
                  <tr key={`${r.assigneeUserId ?? 'null'}-${r.status}-${idx}`}>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{r.assigneeUserId ?? '（未割当）'}</td>
                    <td className="px-3 py-2 text-gray-800">{r.status}</td>
                    <td className="px-3 py-2 text-gray-800">{r.count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

