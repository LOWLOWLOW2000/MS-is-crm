'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { UnderConstructionOverlay } from '@/components/UnderConstructionOverlay'
import { fetchReportAiScorecard } from '@/lib/calling-api'
import type { AiScorecardEntry } from '@/lib/types'

type LoadState = 'idle' | 'loading' | 'success' | 'error'

const formatDateTimeJa = (iso: string | null | undefined): string => {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const formatScore = (score: number | null | undefined): string => {
  if (typeof score !== 'number' || Number.isNaN(score)) return '-'
  return String(Math.round(score * 10) / 10)
}

const safeArray = <T,>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : [])

/**
 * AIスコアカード（一覧＋詳細）。
 * 通話のAI評価（categoryScores/タグ/サマリ）を表示します。
 */
export default function AiScorePage() {
  const { data: session, status } = useSession()
  const accessToken = session?.accessToken ?? ''

  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [reloadSeq, setReloadSeq] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [entries, setEntries] = useState<AiScorecardEntry[]>([])

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    const run = async () => {
      setLoadState('loading')
      setErrorMessage(null)
      try {
        const data = await fetchReportAiScorecard(accessToken)
        if (cancelled) return
        setEntries(data)
        setLoadState('success')
      } catch (e) {
        if (cancelled) return
        setEntries([])
        setLoadState('error')
        setErrorMessage(e instanceof Error ? e.message : 'AIスコアカードの取得に失敗しました')
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [accessToken, reloadSeq])

  const sortedEntries = useMemo(() => {
    const copy = [...entries]
    copy.sort((a, b) => {
      const aMs = new Date(a.evaluatedAt ?? a.callDate).getTime()
      const bMs = new Date(b.evaluatedAt ?? b.callDate).getTime()
      return (Number.isNaN(bMs) ? 0 : bMs) - (Number.isNaN(aMs) ? 0 : aMs)
    })
    return copy
  }, [entries])

  if (status === 'loading') {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6" aria-busy="true">
        <div className="h-8 w-52 animate-pulse rounded-md bg-gray-200" />
        <div className="mt-4 h-32 animate-pulse rounded-xl bg-gray-100" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <h1 className="text-xl font-bold text-gray-900">AIスコアカード</h1>
        <p className="mt-2 text-sm text-gray-600">表示するにはログインしてください。</p>
        <Link
          href="/login"
          className="mt-4 inline-flex rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ログインへ
        </Link>
      </div>
    )
  }

  return (
    <UnderConstructionOverlay ariaLabel="AIスコアカードは準備中です" markSize="compact">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
        <header className="shrink-0">
          <h1 className="text-xl font-bold text-gray-900">AIスコアカード</h1>
          <p className="mt-2 text-sm text-gray-600">
            通話のAI評価（カテゴリ別スコア・タグ・要約）を一覧で確認できます。
          </p>
        </header>

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-label="AIスコアカード一覧">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">一覧</h2>
          <div className="text-xs text-gray-500">
            {loadState === 'loading' ? '読み込み中…' : loadState === 'error' ? '取得失敗' : `${sortedEntries.length} 件`}
          </div>
        </div>

        {loadState === 'loading' ? (
          <div className="mt-4 space-y-3" aria-busy="true">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
                <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
                <div className="mt-2 h-3 w-64 animate-pulse rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : null}

        {loadState === 'error' && errorMessage ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={() => setReloadSeq((v) => v + 1)}
              className="mt-2 inline-flex rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              再試行
            </button>
          </div>
        ) : null}

        {loadState === 'success' && sortedEntries.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
            まだAI評価がありません。評価バッチが投入されるとここに表示されます。
          </div>
        ) : null}

        {sortedEntries.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {sortedEntries.map((entry) => {
              const evaluation = entry.evaluation
              const categoryScores = safeArray(evaluation?.categoryScores)
              const scoreText = formatScore(entry.overallScore)
              const summary = evaluation?.summary ?? null
              const improvementPoints = safeArray(evaluation?.improvementPoints)

              return (
                <li key={entry.callRecordId} className="rounded-xl border border-gray-200 bg-white">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="truncate text-sm font-semibold text-gray-900">{entry.companyName}</span>
                          <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700">
                            {entry.result}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                          <span>
                            <span className="font-medium text-gray-500">架電日</span>
                            <span className="mx-1 text-gray-300">/</span>
                            {formatDateTimeJa(entry.callDate)}
                          </span>
                          <span>
                            <span className="font-medium text-gray-500">評価日</span>
                            <span className="mx-1 text-gray-300">/</span>
                            {formatDateTimeJa(entry.evaluatedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-medium text-gray-500">overall</div>
                        <div className="mt-0.5 text-lg font-bold text-gray-900">{scoreText}</div>
                        <div className="mt-1 text-xs text-gray-500 group-open:hidden">詳細を開く</div>
                        <div className="mt-1 hidden text-xs text-gray-500 group-open:block">閉じる</div>
                      </div>
                    </summary>

                    <div className="border-t border-gray-200 px-4 py-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <section className="rounded-lg border border-gray-200 bg-gray-50/40 p-4" aria-label="要約">
                          <h3 className="text-sm font-semibold text-gray-900">要約</h3>
                          <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
                            {summary && summary.trim() ? summary : '（要約は未登録）'}
                          </p>
                        </section>

                        <section className="rounded-lg border border-gray-200 bg-gray-50/40 p-4" aria-label="改善ポイント">
                          <h3 className="text-sm font-semibold text-gray-900">改善ポイント</h3>
                          {improvementPoints.length > 0 ? (
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                              {improvementPoints.map((p, idx) => (
                                <li key={`${entry.callRecordId}-ip-${idx}`}>{String(p)}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-sm text-gray-700">（改善ポイントは未登録）</p>
                          )}
                        </section>
                      </div>

                      <section className="mt-4 rounded-lg border border-gray-200 bg-white p-4" aria-label="カテゴリ別スコア">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-gray-900">カテゴリ別スコア</h3>
                          <div className="text-xs text-gray-500">{categoryScores.length} カテゴリ</div>
                        </div>

                        {categoryScores.length === 0 ? (
                          <p className="mt-2 text-sm text-gray-600">（カテゴリ別スコアは未登録）</p>
                        ) : (
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            {categoryScores.map((c) => {
                              const tags = safeArray(c.tags)
                              const tagCount = typeof c.tagCount === 'number' ? c.tagCount : tags.length
                              return (
                                <div key={`${entry.callRecordId}-${c.category}`} className="rounded-lg border border-gray-200 bg-gray-50/40 p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-semibold text-gray-900">{c.category}</div>
                                      <div className="mt-0.5 text-xs text-gray-600">{tagCount} tags</div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <div className="text-xs font-medium text-gray-500">score</div>
                                      <div className="text-base font-bold text-gray-900">{formatScore(c.score)}</div>
                                    </div>
                                  </div>

                                  {tags.length > 0 ? (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                      {tags.map((t, idx) => (
                                        <span
                                          key={`${entry.callRecordId}-${c.category}-tag-${idx}`}
                                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700"
                                          title={`${t.tag}: ${String(t.value)}`}
                                        >
                                          <span className="truncate">{t.tag}</span>
                                          <span className="text-gray-300">/</span>
                                          <span className="truncate font-medium text-gray-900">{String(t.value)}</span>
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-3 text-xs text-gray-600">（タグは未登録）</p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </section>
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        ) : null}
        </section>
      </div>
    </UnderConstructionOverlay>
  )
}

