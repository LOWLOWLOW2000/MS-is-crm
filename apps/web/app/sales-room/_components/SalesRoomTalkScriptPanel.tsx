'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchPublishedTalkScriptVersion,
  fetchPublishedTalkScripts,
} from '@/lib/calling-api'
import type { TalkScriptType } from '@/lib/types'
import {
  parseTalkScriptBranching,
  parseTalkScriptLinear,
  type TalkScriptBranchingContent,
  type TalkScriptBranchNode,
} from '@/lib/talk-script-models'

const TYPE_TABS: { key: TalkScriptType; label: string }[] = [
  { key: 'linear', label: '一気通貫' },
  { key: 'branching', label: '分岐' },
]

export interface SalesRoomTalkScriptPanelProps {
  accessToken: string
  /** 企業詳細右カラム向けのコンパクト表示 */
  compact?: boolean
}

/**
 * 公開済みトークスクリプトを型別・版別に読み取り表示する（IS 向け）。
 */
export function SalesRoomTalkScriptPanel({ accessToken, compact = false }: SalesRoomTalkScriptPanelProps) {
  const [scriptType, setScriptType] = useState<TalkScriptType>('linear')
  const [summaries, setSummaries] = useState<{ id: string; label: string }[]>([])
  const [versionId, setVersionId] = useState<string>('')
  const [detailLabel, setDetailLabel] = useState<string>('')
  const [contentRaw, setContentRaw] = useState<unknown>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [branchState, setBranchState] = useState<TalkScriptBranchingContent | null>(null)
  const [branchCursor, setBranchCursor] = useState<string>('')

  const linear = useMemo(() => parseTalkScriptLinear(contentRaw), [contentRaw])

  const loadList = useCallback(async () => {
    setLoadingList(true)
    setError(null)
    try {
      const rows = await fetchPublishedTalkScripts(accessToken, scriptType)
      setSummaries(rows.map((r) => ({ id: r.id, label: r.label })))
      setVersionId((prev) => {
        if (rows.some((r) => r.id === prev)) return prev
        return rows[0]?.id ?? ''
      })
    } catch {
      setSummaries([])
      setVersionId('')
      setError('一覧の取得に失敗しました')
    } finally {
      setLoadingList(false)
    }
  }, [accessToken, scriptType])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!versionId) {
        setDetailLabel('')
        setContentRaw(null)
        setBranchState(null)
        setBranchCursor('')
        return
      }
      setLoadingDetail(true)
      setError(null)
      try {
        const d = await fetchPublishedTalkScriptVersion(accessToken, versionId)
        if (cancelled) return
        setDetailLabel(d.label)
        setContentRaw(d.content)
        const br = parseTalkScriptBranching(d.content)
        if (br) {
          setBranchState(br)
          setBranchCursor(br.startNodeId)
        } else {
          setBranchState(null)
          setBranchCursor('')
        }
      } catch {
        if (!cancelled) {
          setDetailLabel('')
          setContentRaw(null)
          setError('本文の取得に失敗しました')
        }
      } finally {
        if (!cancelled) setLoadingDetail(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [accessToken, versionId])

  const nodeMap = useMemo(() => {
    if (!branchState) return new Map<string, TalkScriptBranchNode>()
    return new Map(branchState.nodes.map((n) => [n.id, n]))
  }, [branchState])

  const effectiveBranchCursor =
    branchState != null && branchCursor !== '' && nodeMap.has(branchCursor)
      ? branchCursor
      : (branchState?.startNodeId ?? '')

  const currentBranchNode =
    effectiveBranchCursor !== '' ? nodeMap.get(effectiveBranchCursor) : undefined

  const outerClass = compact
    ? 'flex max-h-52 flex-col gap-1.5 overflow-hidden text-[11px]'
    : 'flex flex-col gap-3'

  return (
    <div className={outerClass}>
      <div className="flex flex-wrap items-center gap-1 border-b border-indigo-100 pb-1">
        {TYPE_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setScriptType(key)}
            className={`rounded px-2 py-0.5 text-[11px] font-medium ${
              scriptType === key
                ? 'bg-indigo-600 text-white'
                : 'bg-white/80 text-indigo-800 ring-1 ring-indigo-200 hover:bg-indigo-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-1 text-[11px] text-indigo-900">
          <span className="shrink-0">版</span>
          <select
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
            disabled={loadingList || summaries.length === 0}
            className="min-w-0 flex-1 rounded border border-indigo-200 bg-white px-1 py-0.5 text-[11px] text-gray-900"
          >
            {summaries.length === 0 ? (
              <option value="">公開版なし</option>
            ) : (
              summaries.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))
            )}
          </select>
        </label>
        {loadingDetail ? (
          <span className="text-[10px] text-indigo-600">読込中…</span>
        ) : null}
      </div>

      {detailLabel && !compact ? (
        <p className="text-xs font-medium text-indigo-950">{detailLabel}</p>
      ) : null}

      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}

      {scriptType === 'linear' && linear ? (
        <div
          className={
            compact
              ? 'min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5'
              : 'max-h-[min(60vh,28rem)] space-y-2 overflow-y-auto pr-1'
          }
        >
          {linear.blocks.map((block, idx) => (
            <details
              key={`${block.title}-${idx}`}
              open={!compact && idx === 0}
              className="rounded border border-indigo-100 bg-white/90 px-2 py-1.5"
            >
              <summary className="cursor-pointer text-[11px] font-semibold text-indigo-950">
                {block.title.trim() || `章 ${idx + 1}`}
              </summary>
              <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-gray-800">
                {block.body}
              </p>
            </details>
          ))}
        </div>
      ) : null}

      {scriptType === 'linear' && !linear && contentRaw != null && !loadingDetail ? (
        <p className="text-[11px] text-amber-800">線形フォーマットとして解釈できませんでした。</p>
      ) : null}

      {scriptType === 'branching' && branchState ? (
        <div
          className={
            compact
              ? 'min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5'
              : 'max-h-[min(60vh,28rem)] space-y-2 overflow-y-auto pr-1'
          }
        >
          {!currentBranchNode ? (
            <p className="text-[11px] text-amber-800">
              現在ノードが見つかりません。データを確認してください。
            </p>
          ) : (
            <>
              <div className="rounded border border-indigo-100 bg-white/90 px-2 py-1.5">
                <p className="text-[11px] font-semibold text-indigo-950">
                  {currentBranchNode.title}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-gray-800">
                  {currentBranchNode.body}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {currentBranchNode.choices.map((ch, i) => (
                  <button
                    key={`${ch.label}-${i}`}
                    type="button"
                    onClick={() => {
                      if (ch.nextNodeId == null) {
                        setBranchCursor(branchState.startNodeId)
                        return
                      }
                      setBranchCursor(ch.nextNodeId)
                    }}
                    className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-900 hover:bg-indigo-100"
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setBranchCursor(branchState.startNodeId)}
                className="text-[10px] text-indigo-700 underline"
              >
                分岐の先頭へ戻る
              </button>
            </>
          )}
        </div>
      ) : null}

      {scriptType === 'branching' && !branchState && contentRaw != null && !loadingDetail ? (
        <p className="text-[11px] text-amber-800">分岐フォーマットとして解釈できませんでした。</p>
      ) : null}

      {summaries.length === 0 && !loadingList ? (
        <p className="text-[11px] text-gray-600">
          公開済みのスクリプトがありません。ディレクターが「トークスクリプト」から公開してください。
        </p>
      ) : null}
    </div>
  )
}
