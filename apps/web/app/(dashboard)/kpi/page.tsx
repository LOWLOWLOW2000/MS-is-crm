// eslint-disable-next-line react-hooks/exhaustive-deps
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { fetchReportByMember } from '@/lib/calling-api'
import type { ReportByMember, ReportByMemberItem, ReportPeriod } from '@/lib/types'

type Scope = 'all' | 'team' | 'personal' | 'pj'
type LoadState = 'idle' | 'loading' | 'success' | 'error'

type KpiGoals = {
  callPerHour: number
  appointmentRate: number
  materialSendRate: number
  redialAcquisitionRate: number
  cutContactRate: number
}

const DEFAULT_GOALS: KpiGoals = {
  callPerHour: 0,
  appointmentRate: 0,
  materialSendRate: 0,
  redialAcquisitionRate: 0,
  cutContactRate: 0,
}

const GOALS_STORAGE_KEY = 'is01:kpi:goals:v1'

const clampPositive = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0)

const safeRate = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return 0
  return (numerator / denominator) * 100
}

const safeAchievementRate = (actual: number, goal: number): number | null => {
  const g = clampPositive(goal)
  if (g === 0) return null
  return (actual / g) * 100
}

const formatPercent = (v: number): string => `${Math.round(v * 10) / 10}%`

const elapsedHoursFromStartAt = (startAtIso: string | undefined): number => {
  if (!startAtIso) return 1
  const start = new Date(startAtIso)
  const startMs = start.getTime()
  if (Number.isNaN(startMs)) return 1
  const nowMs = Date.now()
  const diffHours = (nowMs - startMs) / (60 * 60 * 1000)
  return Math.max(diffHours, 1 / 60)
}

function computeMemberKpis(member: ReportByMemberItem, elapsedHours: number) {
  const callsPerHour = member.totalCalls / elapsedHours
  // 有効会話（接続）からの出口/見込み率にする
  const appointmentRate = safeRate(member.appointmentCount, member.connectedCount)
  const materialSendRate = safeRate(member.materialSendCount, member.connectedCount)
  const redialAcquisitionRate = safeRate(member.recallScheduledCount, member.connectedCount)
  const cutContactRate = safeRate(member.interestedCount, member.connectedCount)

  return { callsPerHour, appointmentRate, materialSendRate, redialAcquisitionRate, cutContactRate }
}

function sumMemberStats(members: ReportByMemberItem[]) {
  const empty = {
    totalCalls: 0,
    connectedCount: 0,
    appointmentCount: 0,
    materialSendCount: 0,
    interestedCount: 0,
    recallScheduledCount: 0,
  }

  return members.reduce((acc, m) => {
    acc.totalCalls += m.totalCalls
    acc.connectedCount += m.connectedCount
    acc.appointmentCount += m.appointmentCount
    acc.materialSendCount += m.materialSendCount
    acc.interestedCount += m.interestedCount
    acc.recallScheduledCount += m.recallScheduledCount
    return acc
  }, empty)
}

const ScopeOptions: { value: Scope; label: string }[] = [
  { value: 'all', label: '全体' },
  { value: 'team', label: 'Team' },
  { value: 'personal', label: '個人' },
  { value: 'pj', label: 'PJ' },
]

const PeriodOptions: { value: ReportPeriod; label: string }[] = [
  { value: 'daily', label: '日次' },
  { value: 'weekly', label: '週次' },
  { value: 'monthly', label: '月次' },
]

function MetricCard({
  label,
  goal,
  actual,
  actualText,
  unit,
  statsText,
}: {
  label: string
  goal: number
  actual: number
  actualText: string
  unit?: string
  statsText?: string
}) {
  const achievement = safeAchievementRate(actual, goal)
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-4">
      <div className="text-xs font-medium text-gray-600">{label}</div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{actualText}</div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="text-xs text-gray-500">{goal > 0 ? `目標: ${goal}${unit ?? ''}` : '目標: 未設定'}</div>
        <div className="shrink-0 text-right text-xs font-bold text-gray-900">
          {achievement === null ? '—' : `達成率 ${formatPercent(achievement)}`}
        </div>
      </div>

      {statsText ? <div className="mt-2 text-xs text-gray-600">{statsText}</div> : null}
    </div>
  )
}

export default function KpiPage() {
  const { data: session, status } = useSession()
  const accessToken = session?.accessToken ?? ''

  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [period, setPeriod] = useState<ReportPeriod>('daily')
  const [reloadSeq, setReloadSeq] = useState(0)

  const [scope, setScope] = useState<Scope>('personal')
  const [goals, setGoals] = useState<KpiGoals>(DEFAULT_GOALS)

  const [reportByMember, setReportByMember] = useState<ReportByMember | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(GOALS_STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Partial<KpiGoals>
      setGoals({
        callPerHour: Number(parsed.callPerHour ?? 0),
        appointmentRate: Number(parsed.appointmentRate ?? 0),
        materialSendRate: Number(parsed.materialSendRate ?? 0),
        redialAcquisitionRate: Number(parsed.redialAcquisitionRate ?? 0),
        cutContactRate: Number(parsed.cutContactRate ?? 0),
      })
    } catch {
      // 無視
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals))
  }, [goals])

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
      } catch (e) {
        if (cancelled) return
        setReportByMember(null)
        setLoadState('error')
        setErrorMessage(e instanceof Error ? e.message : 'KPIデータの取得に失敗しました')
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
  const teamMemberForCalc = useMemo<ReportByMemberItem>(() => {
    const connectedRate = teamStats.totalCalls === 0 ? 0 : safeRate(teamStats.connectedCount, teamStats.totalCalls)
    return {
      userId: 'team',
      email: '',
      name: 'Team合計',
      totalCalls: teamStats.totalCalls,
      connectedCount: teamStats.connectedCount,
      connectedRate,
      appointmentCount: teamStats.appointmentCount,
      materialSendCount: teamStats.materialSendCount,
      interestedCount: teamStats.interestedCount,
      recallScheduledCount: teamStats.recallScheduledCount,
    }
  }, [teamStats])

  const teamKpis = useMemo(() => computeMemberKpis(teamMemberForCalc, elapsedHours), [teamMemberForCalc, elapsedHours])

  const aiDiagnosis = useMemo(() => {
    const notes: string[] = []
    if (goals.callPerHour > 0 && teamKpis.callsPerHour < goals.callPerHour) notes.push('加電数（行動量）が不足しています')
    if (goals.appointmentRate > 0 && teamKpis.appointmentRate < goals.appointmentRate) notes.push('アポ率が目標未達です')
    if (goals.materialSendRate > 0 && teamKpis.materialSendRate < goals.materialSendRate) notes.push('資料送付率が目標未達です')
    if (goals.redialAcquisitionRate > 0 && teamKpis.redialAcquisitionRate < goals.redialAcquisitionRate) notes.push('再加電取得率が目標未達です')
    if (goals.cutContactRate > 0 && teamKpis.cutContactRate < goals.cutContactRate) notes.push('切り満接触率（ターゲット精度）が目標未達です')
    if (notes.length === 0) return '目標に対して大きな未達は見当たりません。次は細部を調整しましょう。'
    return notes.join(' / ')
  }, [goals, teamKpis])

  if (status === 'loading' || loadState === 'loading') {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-24 animate-pulse rounded bg-gray-100" />
      </div>
    )
  }

  if (!accessToken) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6">
        <h1 className="text-xl font-bold text-gray-900">KPIページ（AI）</h1>
        <p className="mt-2 text-sm text-gray-600">表示するにはログインしてください。</p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6">
        <h1 className="text-xl font-bold text-gray-900">KPIページ（AI）</h1>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <p>{errorMessage ?? '取得に失敗しました'}</p>
          <button
            type="button"
            onClick={() => setReloadSeq((v) => v + 1)}
            className="mt-2 inline-flex rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            再試行
          </button>
        </div>
      </div>
    )
  }

  const showTeam = scope === 'all' || scope === 'team' || scope === 'pj'

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
      <header className="shrink-0">
        <h1 className="text-xl font-bold text-gray-900">KPIページ（AI）</h1>
        <p className="mt-2 text-sm text-gray-600">
          KPIの目標（Target）・実績（Actual）・達成率（Achievement）を5指標で可視化します。
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-6">
        <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-6 shadow-sm" aria-label="KPI重点指標">
          <h2 className="text-base font-semibold text-blue-900">IS個人が最も気にする数字（重点5指標）</h2>
          <ul className="mt-3 grid gap-2 text-sm text-blue-900 md:grid-cols-2">
            <li>1時間あたりの加電数（行動量）</li>
            <li>アポ率（最終成果）</li>
            <li>資料送付率（有効会話の質）</li>
            <li>再加電取得率（見込み管理）</li>
            <li className="md:col-span-2">切り満接触率（ターゲット精度）</li>
          </ul>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-label="表示スコープ">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">表示スコープ</h2>
              <p className="mt-1 text-sm text-gray-500">全体・Team・個人（PJは暫定表示） + 期間切替</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {ScopeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setScope(opt.value)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      scope === opt.value ? 'border-blue-400 bg-blue-50 text-blue-900' : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {PeriodOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPeriod(opt.value)}
                    className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                      period === opt.value ? 'border-indigo-400 bg-indigo-50 text-indigo-900' : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            期間: {period === 'daily' ? '日次' : period === 'weekly' ? '週次' : '月次'} / 経過時間: {Math.round(elapsedHours * 10) / 10}時間（計算用）
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-label="目標設定">
          <h2 className="text-base font-semibold text-gray-900">KPI目標（入力）</h2>
          <p className="mt-1 text-sm text-gray-500">未設定（0）の項目は達成率を「—」で表示します</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-xs font-medium text-gray-600">1時間あたりの加電数（行動量）目標</span>
              <input
                inputMode="decimal"
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm"
                value={goals.callPerHour}
                onChange={(e) => setGoals((g) => ({ ...g, callPerHour: Number(e.target.value) }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-gray-600">アポ率（最終成果）目標（%）</span>
              <input
                inputMode="decimal"
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm"
                value={goals.appointmentRate}
                onChange={(e) => setGoals((g) => ({ ...g, appointmentRate: Number(e.target.value) }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-gray-600">資料送付率（有効会話の質）目標（%）</span>
              <input
                inputMode="decimal"
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm"
                value={goals.materialSendRate}
                onChange={(e) => setGoals((g) => ({ ...g, materialSendRate: Number(e.target.value) }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-gray-600">再加電取得率（見込み管理）目標（%）</span>
              <input
                inputMode="decimal"
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm"
                value={goals.redialAcquisitionRate}
                onChange={(e) => setGoals((g) => ({ ...g, redialAcquisitionRate: Number(e.target.value) }))}
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="text-xs font-medium text-gray-600">切り満接触率（ターゲット精度）目標（%）</span>
              <input
                inputMode="decimal"
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm"
                value={goals.cutContactRate}
                onChange={(e) => setGoals((g) => ({ ...g, cutContactRate: Number(e.target.value) }))}
              />
            </label>
          </div>
        </section>

        {showTeam ? (
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-label="結果（Team/全体）">
            <h2 className="text-base font-semibold text-gray-900">実施結果（当日・合計）</h2>
            <div className="mt-2 text-xs text-gray-500">計測は当日（daily）データです</div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <MetricCard
                label="1時間あたりの加電数（行動量）"
                goal={goals.callPerHour}
                actual={teamKpis.callsPerHour}
                actualText={`${Math.round(teamKpis.callsPerHour * 10) / 10} /h`}
                statsText={`実数: ${teamStats.totalCalls} calls`}
              />
              <MetricCard
                label="アポ率（最終成果）"
                goal={goals.appointmentRate}
                actual={teamKpis.appointmentRate}
                actualText={formatPercent(teamKpis.appointmentRate)}
                unit="%"
                statsText={`実数: ${teamStats.appointmentCount} / 接続 ${teamStats.connectedCount}`}
              />
              <MetricCard
                label="資料送付率（有効会話の質）"
                goal={goals.materialSendRate}
                actual={teamKpis.materialSendRate}
                actualText={formatPercent(teamKpis.materialSendRate)}
                unit="%"
                statsText={`実数: ${teamStats.materialSendCount} / 接続 ${teamStats.connectedCount}`}
              />
              <MetricCard
                label="再加電取得率（見込み管理）"
                goal={goals.redialAcquisitionRate}
                actual={teamKpis.redialAcquisitionRate}
                actualText={formatPercent(teamKpis.redialAcquisitionRate)}
                unit="%"
                statsText={`実数: ${teamStats.recallScheduledCount} / 接続 ${teamStats.connectedCount}`}
              />
              <div className="md:col-span-2">
                <MetricCard
                  label="切り満接触率（ターゲット精度）"
                  goal={goals.cutContactRate}
                  actual={teamKpis.cutContactRate}
                  actualText={formatPercent(teamKpis.cutContactRate)}
                  unit="%"
                  statsText={`実数: 興味 ${teamStats.interestedCount} / 接続 ${teamStats.connectedCount}`}
                />
              </div>
            </div>
          </section>
        ) : null}

        {scope === 'personal' ? (
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-label="個人別 KPI">
            <h2 className="text-base font-semibold text-gray-900">IS個人別 KPI</h2>
            <p className="mt-1 text-sm text-gray-500">当日データから、5指標の達成状況を表示します</p>

            {members.length > 0 ? (
              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/40 px-3 py-2 text-xs text-gray-700">
                行動量（加電/h）ランキング: {' '}
                {members
                  .slice()
                  .sort((a, b) => computeMemberKpis(b, elapsedHours).callsPerHour - computeMemberKpis(a, elapsedHours).callsPerHour)
                  .slice(0, 3)
                  .map((m, idx) => `${idx + 1}. ${m.name || '—'}`)
                  .join(' / ')}
              </div>
            ) : null}

            {members.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/40 p-6 text-center text-sm text-gray-500">
                該当する架電データがありません
              </div>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {members
                  .slice()
                  .sort((a, b) => b.totalCalls - a.totalCalls)
                  .map((m) => {
                    const kpis = computeMemberKpis(m, elapsedHours)
                    return (
                      <div key={m.userId} className="rounded-lg border border-gray-200 bg-gray-50/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{m.name || '—'}</div>
                            <div className="mt-1 text-xs text-gray-600">実数: {m.totalCalls} calls</div>
                          </div>
                          <div className="text-xs text-gray-500">
                            接続: {m.connectedCount} ({formatPercent(m.connectedRate)})
                          </div>
                        </div>

                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-gray-600">加電 /h</div>
                            <div className="text-xs font-semibold text-gray-900">
                              {Math.round(kpis.callsPerHour * 10) / 10} /h
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-gray-600">アポ率</div>
                            <div className="text-xs font-semibold text-gray-900">{formatPercent(kpis.appointmentRate)}</div>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-gray-600">資料送付率</div>
                            <div className="text-xs font-semibold text-gray-900">{formatPercent(kpis.materialSendRate)}</div>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-gray-600">再加電取得率</div>
                            <div className="text-xs font-semibold text-gray-900">{formatPercent(kpis.redialAcquisitionRate)}</div>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-gray-600">切り満接触率</div>
                            <div className="text-xs font-semibold text-gray-900">{formatPercent(kpis.cutContactRate)}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </section>
        ) : null}

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-label="AI診断（簡易）">
          <h2 className="text-base font-semibold text-gray-900">AI診断（簡易）</h2>
          <p className="mt-1 text-sm text-gray-500">目標に対する未達ポイントをルールベースで要約します</p>
          <div className="mt-4 min-h-[80px] rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-4 text-sm text-gray-800 whitespace-pre-wrap">
            {aiDiagnosis}
          </div>
        </section>
      </div>
    </div>
  )
}
