'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { UnderConstructionOverlay } from '@/components/UnderConstructionOverlay'
import {
  fetchKpiGoalMatrix,
  fetchMyProfile,
  fetchReportByMember,
  upsertKpiGoal,
} from '@/lib/calling-api'
import type { KpiGoalValues, ReportByMemberItem } from '@/lib/types'

interface GoalFormState extends KpiGoalValues {}

const DEFAULT_GOALS: GoalFormState = {
  callPerHour: 0,
  appointmentRate: 0,
  materialSendRate: 0,
  redialAcquisitionRate: 0,
  cutContactRate: 0,
  keyPersonContactRate: 0,
}

const toGoalNumber = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

const normalizeGoalValues = (raw: KpiGoalValues | null | undefined): GoalFormState => ({
  callPerHour: raw?.callPerHour ?? 0,
  appointmentRate: raw?.appointmentRate ?? 0,
  materialSendRate: raw?.materialSendRate ?? 0,
  redialAcquisitionRate: raw?.redialAcquisitionRate ?? 0,
  cutContactRate: raw?.cutContactRate ?? 0,
  keyPersonContactRate: raw?.keyPersonContactRate ?? 0,
})

const hasChanges = (a: GoalFormState, b: GoalFormState): boolean =>
  JSON.stringify(a) !== JSON.stringify(b)

const goalFields: { key: keyof GoalFormState; label: string; unit: string }[] = [
  { key: 'callPerHour', label: '1時間あたりの架電数（絶対ライン）', unit: '/h' },
  { key: 'appointmentRate', label: 'アポ率', unit: '%' },
  { key: 'materialSendRate', label: '資料送付率', unit: '%' },
  { key: 'redialAcquisitionRate', label: '再架電取得率', unit: '%' },
  { key: 'cutContactRate', label: '需要あるキー接触率', unit: '%' },
  { key: 'keyPersonContactRate', label: 'キーパーソン接触率', unit: '%' },
]

const GoalInputGrid = ({
  goals,
  disabled,
  onFieldChange,
}: {
  goals: GoalFormState
  disabled: boolean
  onFieldChange: (key: keyof GoalFormState, value: number) => void
}) => (
  <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
    {goalFields.map(({ key, label, unit }) => (
      <label
        key={key}
        className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
      >
        <span className="truncate">{label}</span>
        <span className="relative w-28 shrink-0">
          <input
            inputMode="decimal"
            disabled={disabled}
            value={goals[key]}
            onChange={(event) => onFieldChange(key, toGoalNumber(event.target.value))}
            className="w-full rounded-md border border-zinc-200 py-1 pl-2 pr-8 text-right text-xs tabular-nums text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">
            {unit}
          </span>
        </span>
      </label>
    ))}
  </div>
)

export default function KpiGoalsPage() {
  const { data: session, status } = useSession()
  const accessToken = session?.accessToken ?? ''
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [members, setMembers] = useState<ReportByMemberItem[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  const [projectGoals, setProjectGoals] = useState<GoalFormState>(DEFAULT_GOALS)
  const [isAllGoals, setIsAllGoals] = useState<GoalFormState>(DEFAULT_GOALS)
  const [isUserGoalsMap, setIsUserGoalsMap] = useState<Record<string, GoalFormState>>({})

  const [projectDraft, setProjectDraft] = useState<GoalFormState>(DEFAULT_GOALS)
  const [isAllDraft, setIsAllDraft] = useState<GoalFormState>(DEFAULT_GOALS)
  const [isUserDraft, setIsUserDraft] = useState<GoalFormState>(DEFAULT_GOALS)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    const run = async () => {
      setIsLoading(true)
      setErrorMessage(null)
      try {
        const [matrix, reportByMember, profile] = await Promise.all([
          fetchKpiGoalMatrix(accessToken),
          fetchReportByMember(accessToken, 'daily'),
          fetchMyProfile(accessToken),
        ])
        if (cancelled) return

        const nextProjectGoals = normalizeGoalValues(matrix.projectGoal)
        const nextIsAllGoals = normalizeGoalValues(matrix.isAllGoal)
        const nextIsUserGoalsMap = matrix.isUserGoals.reduce<Record<string, GoalFormState>>((acc, row) => {
          if (row.targetUserId) {
            acc[row.targetUserId] = normalizeGoalValues(row)
          }
          return acc
        }, {})
        const nextMembers = reportByMember.members
        const firstUserId = nextMembers[0]?.userId ?? ''
        const nextSelectedUserId = selectedUserId || firstUserId

        setProjectGoals(nextProjectGoals)
        setIsAllGoals(nextIsAllGoals)
        setIsUserGoalsMap(nextIsUserGoalsMap)
        setProjectDraft(nextProjectGoals)
        setIsAllDraft(nextIsAllGoals)
        setMembers(nextMembers)
        setSelectedUserId(nextSelectedUserId)
        setIsUserDraft(nextIsUserGoalsMap[nextSelectedUserId] ?? nextIsAllGoals)

        const roles = profile.roles ?? []
        const hasDirectorRole = roles.includes('director') || profile.role === 'director'
        const hasProjectDirectorAssignment = profile.projectAssignment?.pjRole === 'director'
        setCanEdit(hasDirectorRole || hasProjectDirectorAssignment)
      } catch (error) {
        if (cancelled) return
        setErrorMessage(error instanceof Error ? error.message : 'KPI目標の取得に失敗しました')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [accessToken])

  useEffect(() => {
    const next = isUserGoalsMap[selectedUserId] ?? isAllGoals
    setIsUserDraft(next)
  }, [selectedUserId, isUserGoalsMap, isAllGoals])

  const selectedMemberName = useMemo(
    () => members.find((m) => m.userId === selectedUserId)?.name ?? '未選択',
    [members, selectedUserId],
  )

  if (status === 'loading' || isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-md bg-zinc-200" />
        <div className="h-36 animate-pulse rounded-2xl bg-zinc-100" />
      </div>
    )
  }

  if (!accessToken) {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">KPI目標設定</h1>
        <p className="mt-2 text-sm text-zinc-500">表示するにはログインしてください。</p>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">KPI目標設定</h1>
        <p className="mt-2 text-sm text-rose-700">{errorMessage}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="space-y-1">
        <nav className="text-xs text-zinc-500" aria-label="パンくず">
          <Link href="/dashboard" className="hover:text-zinc-700">
            ダッシュボード
          </Link>
          <span className="mx-1.5 text-zinc-400">/</span>
          <span className="font-medium text-zinc-700">KPI目標設定</span>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">KPI目標設定</h1>
        <p className="text-sm text-zinc-500">
          PJ目標値と IS 全体 / IS個別 の目標値を設定します。編集はディレクター権限のみ可能です。
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">PJ目標値（チーム / プロジェクト）</h2>
          <button
            type="button"
            disabled={!canEdit || !hasChanges(projectDraft, projectGoals)}
            onClick={async () => {
              if (!canEdit) return
              const saved = await upsertKpiGoal(accessToken, { scope: 'project', ...projectDraft })
              const next = normalizeGoalValues(saved)
              setProjectGoals(next)
              setProjectDraft(next)
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              !canEdit
                ? 'cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-400'
                : hasChanges(projectDraft, projectGoals)
                  ? 'border border-blue-700 bg-blue-600 text-white hover:bg-blue-700'
                  : 'cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-500'
            }`}
          >
            {!canEdit ? '権限なし' : hasChanges(projectDraft, projectGoals) ? '変更を保存' : '変更なし'}
          </button>
        </div>
        <GoalInputGrid
          goals={projectDraft}
          disabled={!canEdit}
          onFieldChange={(key, value) => setProjectDraft((prev) => ({ ...prev, [key]: value }))}
        />
      </section>

      <section className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">IS全体 KPI目標</h2>
          <button
            type="button"
            disabled={!canEdit || !hasChanges(isAllDraft, isAllGoals)}
            onClick={async () => {
              if (!canEdit) return
              const saved = await upsertKpiGoal(accessToken, { scope: 'is_all', ...isAllDraft })
              const next = normalizeGoalValues(saved)
              setIsAllGoals(next)
              setIsAllDraft(next)
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              !canEdit
                ? 'cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-400'
                : hasChanges(isAllDraft, isAllGoals)
                  ? 'border border-blue-700 bg-blue-600 text-white hover:bg-blue-700'
                  : 'cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-500'
            }`}
          >
            {!canEdit ? '権限なし' : hasChanges(isAllDraft, isAllGoals) ? '変更を保存' : '変更なし'}
          </button>
        </div>
        <GoalInputGrid
          goals={isAllDraft}
          disabled={!canEdit}
          onFieldChange={(key, value) => setIsAllDraft((prev) => ({ ...prev, [key]: value }))}
        />
      </section>

      <UnderConstructionOverlay ariaLabel="IS個別KPI目標の編集エリアは準備中です">
        <section className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-900">IS個別 KPI目標</h2>
            <button
              type="button"
              disabled={!canEdit || !selectedUserId || !hasChanges(isUserDraft, isUserGoalsMap[selectedUserId] ?? isAllGoals)}
              onClick={async () => {
                if (!canEdit || !selectedUserId) return
                const saved = await upsertKpiGoal(accessToken, {
                  scope: 'is_user',
                  targetUserId: selectedUserId,
                  ...isUserDraft,
                })
                const next = normalizeGoalValues(saved)
                setIsUserGoalsMap((prev) => ({ ...prev, [selectedUserId]: next }))
                setIsUserDraft(next)
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                !canEdit
                  ? 'cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-400'
                  : selectedUserId && hasChanges(isUserDraft, isUserGoalsMap[selectedUserId] ?? isAllGoals)
                    ? 'border border-blue-700 bg-blue-600 text-white hover:bg-blue-700'
                    : 'cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-500'
              }`}
            >
              {!canEdit ? '権限なし' : '変更を保存'}
            </button>
          </div>
          <div className="mt-2">
            <label className="text-xs text-zinc-600">対象ISメンバー</label>
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            >
              {members.length === 0 ? <option value="">ISメンバーなし</option> : null}
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name || member.email || member.userId}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">選択中: {selectedMemberName}</p>
          </div>
          <GoalInputGrid
            goals={isUserDraft}
            disabled={!canEdit || !selectedUserId}
            onFieldChange={(key, value) => setIsUserDraft((prev) => ({ ...prev, [key]: value }))}
          />
        </section>
      </UnderConstructionOverlay>
    </div>
  )
}
