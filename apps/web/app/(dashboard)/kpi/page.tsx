'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { fetchKpiGoalMatrix, fetchReportByMember } from '@/lib/calling-api'
import type { KpiGoalValues, ReportByMember, ReportByMemberItem, ReportPeriod } from '@/lib/types'

type ViewMode = 'personal' | 'team'
type LoadState = 'idle' | 'loading' | 'success' | 'error'

interface KpiGoals {
  callPerHour: number
  keyPersonContactRate: number
  appointmentRate: number
  materialSendRate: number
  redialAcquisitionRate: number
  cutContactRate: number
}

const DEFAULT_GOALS: KpiGoals = {
  callPerHour: 0,
  keyPersonContactRate: 0,
  appointmentRate: 0,
  materialSendRate: 0,
  redialAcquisitionRate: 0,
  cutContactRate: 0,
}

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: 'daily', label: '日次' },
  { value: 'weekly', label: '週次' },
  { value: 'monthly', label: '月次' },
]

const normalizeGoalValues = (raw: KpiGoalValues | null | undefined): KpiGoals => ({
  callPerHour: raw?.callPerHour ?? 0,
  appointmentRate: raw?.appointmentRate ?? 0,
  materialSendRate: raw?.materialSendRate ?? 0,
  redialAcquisitionRate: raw?.redialAcquisitionRate ?? 0,
  cutContactRate: raw?.cutContactRate ?? 0,
  keyPersonContactRate: raw?.keyPersonContactRate ?? 0,
})

const safeRate = (numerator: number, denominator: number): number =>
  denominator <= 0 ? 0 : (numerator / denominator) * 100

const safeAchievementRate = (actual: number, goal: number): number | null =>
  goal > 0 ? (actual / goal) * 100 : null

const formatPercent = (v: number): string => `${Math.round(v * 10) / 10}%`
const roundOneDecimal = (v: number): number => Math.round(v * 10) / 10
const roundCount = (v: number): number => Math.max(0, Math.round(v))

const elapsedHoursFromStartAt = (startAtIso: string | undefined): number => {
  if (!startAtIso) return 1
  const startMs = new Date(startAtIso).getTime()
  if (Number.isNaN(startMs)) return 1
  const diffHours = (Date.now() - startMs) / (60 * 60 * 1000)
  return Math.max(diffHours, 1 / 60)
}

const computeMemberKpis = (member: ReportByMemberItem, elapsedHours: number) => ({
  callsPerHour: member.totalCalls / elapsedHours,
  appointmentRate: safeRate(member.appointmentCount, member.connectedCount),
  materialSendRate: safeRate(member.materialSendCount, member.connectedCount),
  redialAcquisitionRate: safeRate(member.recallScheduledCount, member.connectedCount),
  cutContactRate: safeRate(member.interestedCount, member.connectedCount),
})

const sumMemberStats = (members: ReportByMemberItem[]) =>
  members.reduce(
    (acc, member) => ({
      totalCalls: acc.totalCalls + member.totalCalls,
      connectedCount: acc.connectedCount + member.connectedCount,
      appointmentCount: acc.appointmentCount + member.appointmentCount,
      materialSendCount: acc.materialSendCount + member.materialSendCount,
      interestedCount: acc.interestedCount + member.interestedCount,
      recallScheduledCount: acc.recallScheduledCount + member.recallScheduledCount,
    }),
    {
      totalCalls: 0,
      connectedCount: 0,
      appointmentCount: 0,
      materialSendCount: 0,
      interestedCount: 0,
      recallScheduledCount: 0,
    },
  )

const cardClass = 'rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm'

/**
 * Kiranism 風の KPI ダッシュボード。
 * 既存 KPI ロジック（目標・達成率・Team/Personal 集計）を維持しつつ Recharts で可視化する。
 */
export default function KpiPage() {
  const { data: session, status } = useSession()
  const accessToken = session?.accessToken ?? ''
  const userId = session?.user?.id ?? ''
  const [viewMode, setViewMode] = useState<ViewMode>('personal')
  const [period, setPeriod] = useState<ReportPeriod>('daily')
  const [reloadSeq, setReloadSeq] = useState(0)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isAllGoals, setIsAllGoals] = useState<KpiGoals>(DEFAULT_GOALS)
  const [personalGoals, setPersonalGoals] = useState<KpiGoals>(DEFAULT_GOALS)
  const [reportByMember, setReportByMember] = useState<ReportByMember | null>(null)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    const run = async () => {
      try {
        const matrix = await fetchKpiGoalMatrix(accessToken)
        if (cancelled) return
        const project = normalizeGoalValues(matrix.projectGoal)
        const isAll = normalizeGoalValues(matrix.isAllGoal)
        const isUser = normalizeGoalValues(
          matrix.isUserGoals.find((goal) => goal.targetUserId === userId),
        )
        setIsAllGoals(isAll)
        setPersonalGoals(
          isUser.callPerHour > 0 ||
            isUser.appointmentRate > 0 ||
            isUser.materialSendRate > 0 ||
            isUser.redialAcquisitionRate > 0 ||
            isUser.cutContactRate > 0 ||
            isUser.keyPersonContactRate > 0
            ? isUser
            : isAll.callPerHour > 0 ||
                isAll.appointmentRate > 0 ||
                isAll.materialSendRate > 0 ||
                isAll.redialAcquisitionRate > 0 ||
                isAll.cutContactRate > 0 ||
                isAll.keyPersonContactRate > 0
              ? isAll
              : project,
        )
      } catch {
        if (!cancelled) {
          setIsAllGoals(DEFAULT_GOALS)
          setPersonalGoals(DEFAULT_GOALS)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [accessToken, userId])

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    const run = async () => {
      setLoadState('loading')
      setErrorMessage(null)
      try {
        const data = await fetchReportByMember(accessToken, period)
        if (cancelled) return
        setReportByMember(data)
        setLoadState('success')
      } catch (error) {
        if (cancelled) return
        setLoadState('error')
        setErrorMessage(error instanceof Error ? error.message : 'KPIデータの取得に失敗しました')
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [accessToken, period, reloadSeq])

  const members = reportByMember?.members ?? []
  const elapsedHours = useMemo(() => elapsedHoursFromStartAt(reportByMember?.startAt), [reportByMember?.startAt])
  const teamStats = useMemo(() => sumMemberStats(members), [members])

  const teamMember = useMemo<ReportByMemberItem>(
    () => ({
      userId: 'team',
      email: '',
      name: 'Team合計',
      totalCalls: teamStats.totalCalls,
      connectedCount: teamStats.connectedCount,
      connectedRate: safeRate(teamStats.connectedCount, teamStats.totalCalls),
      appointmentCount: teamStats.appointmentCount,
      materialSendCount: teamStats.materialSendCount,
      interestedCount: teamStats.interestedCount,
      recallScheduledCount: teamStats.recallScheduledCount,
    }),
    [teamStats],
  )

  const personalMember = useMemo(() => {
    if (members.length === 0) return null
    const byEmail = members.find((member) => member.email && member.email === session?.user?.email)
    if (byEmail) return byEmail
    const byName = members.find((member) => member.name && member.name === session?.user?.name)
    if (byName) return byName
    return [...members].sort((a, b) => b.totalCalls - a.totalCalls)[0]
  }, [members, session?.user?.email, session?.user?.name])

  const teamKpis = useMemo(() => computeMemberKpis(teamMember, elapsedHours), [teamMember, elapsedHours])
  const personalKpis = useMemo(
    () => (personalMember ? computeMemberKpis(personalMember, elapsedHours) : null),
    [personalMember, elapsedHours],
  )

  const isPersonal = viewMode === 'personal'
  const effectiveGoals = isPersonal ? personalGoals : isAllGoals

  const activeCalls = isPersonal ? personalMember?.totalCalls ?? 0 : teamStats.totalCalls
  const activeWinRate = isPersonal ? personalKpis?.appointmentRate ?? 0 : teamKpis.appointmentRate
  const activeConnectedRate = isPersonal ? personalMember?.connectedRate ?? 0 : teamMember.connectedRate
  const activeMetrics = isPersonal && personalKpis ? personalKpis : teamKpis
  const activeStats = isPersonal
    ? {
        totalCalls: personalMember?.totalCalls ?? 0,
        connectedCount: personalMember?.connectedCount ?? 0,
        appointmentCount: personalMember?.appointmentCount ?? 0,
        materialSendCount: personalMember?.materialSendCount ?? 0,
        recallScheduledCount: personalMember?.recallScheduledCount ?? 0,
        interestedCount: personalMember?.interestedCount ?? 0,
      }
    : {
        totalCalls: teamStats.totalCalls,
        connectedCount: teamStats.connectedCount,
        appointmentCount: teamStats.appointmentCount,
        materialSendCount: teamStats.materialSendCount,
        recallScheduledCount: teamStats.recallScheduledCount,
        interestedCount: teamStats.interestedCount,
      }
  const callGoalCount = effectiveGoals.callPerHour > 0 ? roundCount(effectiveGoals.callPerHour * elapsedHours) : 0
  const topFiveAchievementPanels = [
    {
      id: 'materialSendRate',
      label: '資料送付率',
      actual: activeMetrics.materialSendRate,
      goal: effectiveGoals.materialSendRate,
      actualCount: activeStats.materialSendCount,
      goalCount:
        effectiveGoals.materialSendRate > 0
          ? roundCount((activeStats.connectedCount * effectiveGoals.materialSendRate) / 100)
          : null,
    },
    {
      id: 'redialAcquisitionRate',
      label: '再架電取得率',
      actual: activeMetrics.redialAcquisitionRate,
      goal: effectiveGoals.redialAcquisitionRate,
      actualCount: activeStats.recallScheduledCount,
      goalCount:
        effectiveGoals.redialAcquisitionRate > 0
          ? roundCount((activeStats.connectedCount * effectiveGoals.redialAcquisitionRate) / 100)
          : null,
    },
    {
      id: 'cutContactRate',
      label: '需要あるキー接触率',
      actual: activeMetrics.cutContactRate,
      goal: effectiveGoals.cutContactRate,
      actualCount: activeStats.interestedCount,
      goalCount:
        effectiveGoals.cutContactRate > 0
          ? roundCount((activeStats.connectedCount * effectiveGoals.cutContactRate) / 100)
          : null,
    },
  ] as const
  const callAchievementRate = safeAchievementRate(activeMetrics.callsPerHour, effectiveGoals.callPerHour)
  const callShortageCount = callGoalCount > 0 ? Math.max(callGoalCount - activeStats.totalCalls, 0) : null
  const appointmentGoalCount =
    effectiveGoals.appointmentRate > 0 ? roundCount((activeStats.connectedCount * effectiveGoals.appointmentRate) / 100) : null
  const appointmentShortageCount =
    appointmentGoalCount !== null ? Math.max(appointmentGoalCount - activeStats.appointmentCount, 0) : null
  const contactGoalCount =
    effectiveGoals.keyPersonContactRate > 0 ? roundCount((activeStats.totalCalls * effectiveGoals.keyPersonContactRate) / 100) : null
  const contactShortageCount =
    contactGoalCount !== null ? Math.max(contactGoalCount - activeStats.connectedCount, 0) : null
  const materialGoalCount =
    effectiveGoals.materialSendRate > 0 ? roundCount((activeStats.connectedCount * effectiveGoals.materialSendRate) / 100) : null
  const materialShortageCount =
    materialGoalCount !== null ? Math.max(materialGoalCount - activeStats.materialSendCount, 0) : null
  const redialGoalCount =
    effectiveGoals.redialAcquisitionRate > 0
      ? roundCount((activeStats.connectedCount * effectiveGoals.redialAcquisitionRate) / 100)
      : null
  const redialShortageCount =
    redialGoalCount !== null ? Math.max(redialGoalCount - activeStats.recallScheduledCount, 0) : null
  const interestGoalCount =
    effectiveGoals.cutContactRate > 0 ? roundCount((activeStats.connectedCount * effectiveGoals.cutContactRate) / 100) : null
  const interestShortageCount =
    interestGoalCount !== null ? Math.max(interestGoalCount - activeStats.interestedCount, 0) : null

  const bottleneckCandidates = [
    {
      id: 'callPerHour',
      label: '架電数',
      achievement: callAchievementRate,
      shortage: callShortageCount,
      help: 'まず母数の架電量を引き上げると、他指標も連動して改善しやすくなります。',
    },
    {
      id: 'keyPersonContactRate',
      label: 'キーパーソン接触率',
      achievement: safeAchievementRate(activeConnectedRate, effectiveGoals.keyPersonContactRate),
      shortage: contactShortageCount,
      help: '接続率と受付突破の改善を優先し、スクリプトの冒頭を見直します。',
    },
    {
      id: 'appointmentRate',
      label: 'アポ率',
      achievement: safeAchievementRate(activeWinRate, effectiveGoals.appointmentRate),
      shortage: appointmentShortageCount,
      help: 'ヒアリング後半のオファー設計を調整して、クロージング率を上げます。',
    },
    {
      id: 'materialSendRate',
      label: '資料送付率',
      achievement: safeAchievementRate(activeMetrics.materialSendRate, effectiveGoals.materialSendRate),
      shortage: materialShortageCount,
      help: '送付導線をテンプレート化し、会話中に送付合意を取り切ります。',
    },
    {
      id: 'redialAcquisitionRate',
      label: '再架電取得率',
      achievement: safeAchievementRate(activeMetrics.redialAcquisitionRate, effectiveGoals.redialAcquisitionRate),
      shortage: redialShortageCount,
      help: '次回接触日時を必ず確定し、再架電理由をメモに残します。',
    },
    {
      id: 'cutContactRate',
      label: '需要あるキー接触率',
      achievement: safeAchievementRate(activeMetrics.cutContactRate, effectiveGoals.cutContactRate),
      shortage: interestShortageCount,
      help: '業種別の訴求軸を分け、刺さる質問を先に置きます。',
    },
  ].filter((candidate) => candidate.achievement !== null)

  const bottleneck = [...bottleneckCandidates].sort((a, b) => (a.achievement ?? 0) - (b.achievement ?? 0))[0] ?? null

  const nextAction = (() => {
    if (!bottleneck) {
      return {
        title: 'ボトルネックが判定できません',
        description: 'まず KPI 目標値を設定してから再評価してください。',
        ctaLabel: 'KPI目標設定を開く',
        href: '/director/kpi-goals',
      }
    }
    if (bottleneck.id === 'callPerHour' || bottleneck.id === 'keyPersonContactRate') {
      return {
        title: '接触量の改善に集中',
        description: '架電母数と接触導線の改善が最優先です。直近の実行量を増やしてください。',
        ctaLabel: '架電ルームへ',
        href: '/sales-room',
      }
    }
    if (bottleneck.id === 'appointmentRate') {
      return {
        title: 'アポ化率の改善に集中',
        description: '接触後の提案からクロージングまでの会話設計を見直す局面です。',
        ctaLabel: '架電ルームへ',
        href: '/sales-room',
      }
    }
    return {
      title: 'フォロー品質の改善に集中',
      description: '送付・再架電・興味化のフォロー設計を改善し、取りこぼしを減らしてください。',
      ctaLabel: 'KPI目標設定を開く',
      href: '/director/kpi-goals',
    }
  })()

  if (status === 'loading' || loadState === 'loading') {
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
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">KPI Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-500">表示するにはログインしてください。</p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">KPI Dashboard</h1>
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <p className="text-sm text-rose-800">{errorMessage ?? '取得に失敗しました'}</p>
          <button
            type="button"
            onClick={() => setReloadSeq((value) => value + 1)}
            className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-50"
          >
            再試行
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <style jsx>{`
        @keyframes kpiSevenColorBlink {
          0% {
            color: #3b82f6
          }
          14% {
            color: #06b6d4
          }
          28% {
            color: #eab308
          }
          42% {
            color: #22c55e
          }
          56% {
            color: #14b8a6
          }
          70% {
            color: #8b5cf6
          }
          84% {
            color: #ef4444
          }
          100% {
            color: #3b82f6
          }
        }
      `}</style>
      <header className="space-y-4">
        <nav className="text-xs text-zinc-500" aria-label="パンくず">
          <Link href="/dashboard" className="hover:text-zinc-700">
            ダッシュボード
          </Link>
          <span className="mx-1.5 text-zinc-400">/</span>
          <span className="font-medium text-zinc-700">KPI</span>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">KPI Dashboard</h1>
            <p className="mt-2 text-sm text-zinc-500">
              インサイドセールスの個人・チーム実績を可視化し、目標達成率を確認します。
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('personal')}
              className={`rounded-lg px-6 py-2 text-sm font-medium transition ${
                isPersonal ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              個人成績
            </button>
            <button
              type="button"
              onClick={() => setViewMode('team')}
              className={`rounded-lg px-6 py-2 text-sm font-medium transition ${
                !isPersonal ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              チーム / プロジェクト
            </button>
          </div>
        </div>
      </header>

      <section className={cardClass}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">表示期間</h2>
            <p className="mt-1 text-xs text-zinc-500">
              期間: {period === 'daily' ? '日次' : period === 'weekly' ? '週次' : '月次'} / 経過時間:{' '}
              {roundOneDecimal(elapsedHours)}h
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  period === option.value
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">KPIサマリー</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
            <p className="text-xs font-medium text-zinc-600">今月のコール数</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">{activeCalls.toLocaleString()}</p>
            <p className="mt-1 text-[11px] text-zinc-500">
              達成率 {callGoalCount > 0 ? formatPercent((activeCalls / callGoalCount) * 100) : '—'}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              架電数 {activeCalls.toLocaleString()} / 架電目標数 {callGoalCount > 0 ? callGoalCount.toLocaleString() : '未設定'}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
            <p className="text-xs font-medium text-zinc-600">アポ率（Win Rate）</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">{formatPercent(activeWinRate)}</p>
            <p className="mt-1 text-[11px] text-zinc-500">
              結果 {formatPercent(activeWinRate)}（{activeStats.appointmentCount}件） / 目標{' '}
              {effectiveGoals.appointmentRate > 0
                ? `${formatPercent(effectiveGoals.appointmentRate)}（${roundCount((activeStats.connectedCount * effectiveGoals.appointmentRate) / 100)}件）`
                : '未設定'}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
            <p className="text-xs font-medium text-zinc-600">キーパーソン接触率</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">{formatPercent(activeConnectedRate)}</p>
            <p className="mt-1 text-[11px] text-zinc-500">
              結果 {formatPercent(activeConnectedRate)}（{activeStats.connectedCount}件） / 目標{' '}
              {effectiveGoals.keyPersonContactRate > 0
                ? `${formatPercent(effectiveGoals.keyPersonContactRate)}（${roundCount((activeStats.totalCalls * effectiveGoals.keyPersonContactRate) / 100)}件）`
                : '未設定'}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {topFiveAchievementPanels.map(({ id, label, actual, goal, actualCount, goalCount }) => {
            const achievement = safeAchievementRate(actual, goal)
            const compareRate = achievement ?? actual
            const gimmickClass =
              compareRate >= 150
                ? 'animate-[kpiSevenColorBlink_6s_ease-in-out_infinite] text-red-600'
                : compareRate >= 100
                  ? 'text-blue-600'
                  : compareRate >= 80
                    ? 'text-cyan-500'
                    : compareRate > 70
                      ? 'text-yellow-500'
                      : 'text-red-600'
            return (
              <div key={id} className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
                <p className="text-xs font-medium text-zinc-600">{label}</p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-zinc-700">結果</span>
                  <span className={`text-4xl font-semibold tracking-tight ${gimmickClass}`}>{formatPercent(actual)}</span>
                  <span className="text-2xl font-semibold tracking-tight text-zinc-700">（{actualCount}件）</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                  KPI目標実数・達成率
                  <br />
                  目標{' '}
                  {goal > 0 && goalCount !== null ? `${formatPercent(goal)}（${goalCount}件）` : '未設定'} / 達成率{' '}
                  {achievement === null ? '—' : formatPercent(achievement)}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className={`${cardClass} lg:col-span-1`}>
          <h3 className="text-base font-medium text-zinc-900">ボトルネック判定</h3>
          {bottleneck ? (
            <>
              <p className="mt-4 text-sm text-zinc-500">現在もっとも改善余地が大きい指標</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">{bottleneck.label}</p>
              <p className="mt-2 text-sm text-zinc-600">
                達成率 {bottleneck.achievement === null ? '—' : formatPercent(bottleneck.achievement)}
              </p>
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {bottleneck.help}
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">目標値が未設定のため判定できません。</p>
          )}
        </div>

        <div className={`${cardClass} lg:col-span-2`}>
          <h3 className="text-base font-medium text-zinc-900">あと何件で目標到達か</h3>
          <p className="mt-1 text-xs text-zinc-500">不足件数ベースで、次に増やすべき行動量を可視化します。</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: '架電', shortage: callShortageCount, unit: '件' },
              { label: 'キーパーソン接触', shortage: contactShortageCount, unit: '件' },
              { label: 'アポ獲得', shortage: appointmentShortageCount, unit: '件' },
              { label: '資料送付', shortage: materialShortageCount, unit: '件' },
              { label: '再架電取得', shortage: redialShortageCount, unit: '件' },
              { label: '需要あり接触', shortage: interestShortageCount, unit: '件' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
                <p className="text-xs font-medium text-zinc-600">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
                  {item.shortage === null ? '—' : item.shortage.toLocaleString()}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">{item.shortage === null ? '目標未設定' : item.unit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="text-base font-medium text-zinc-900">次にやること</h3>
        <p className="mt-2 text-sm text-zinc-600">{nextAction.title}</p>
        <p className="mt-1 text-sm text-zinc-500">{nextAction.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={nextAction.href}
            className="inline-flex items-center rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            {nextAction.ctaLabel}
          </Link>
          <Link
            href="/director/kpi-goals"
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            KPI目標を調整
          </Link>
        </div>
      </section>

      <section className={`${cardClass} text-center`}>
        <p className="text-sm text-zinc-500">
          {isPersonal
            ? `${personalMember?.name ?? '個人'} のパフォーマンスを表示中。重要指標の達成率を継続確認してください。`
            : 'チーム全体のパフォーマンスを表示中。行動量とアポ率の相関を優先して改善してください。'}
        </p>
      </section>
    </div>
  )
}
