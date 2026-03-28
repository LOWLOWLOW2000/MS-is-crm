'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  createTalkScriptVersion,
  fetchPublishedTalkScripts,
  fetchTalkScriptDrafts,
  fetchTalkScriptDraftVersion,
  publishTalkScriptVersion,
  updateTalkScriptVersion,
} from '@/lib/calling-api'
import type { TalkScriptType } from '@/lib/types'
import {
  defaultBranchingTalkScriptContent,
  defaultLinearTalkScriptContent,
  parseTalkScriptLinear,
} from '@/lib/talk-script-models'

const TYPE_TABS: { key: TalkScriptType; label: string }[] = [
  { key: 'linear', label: '一気通貫（線形）' },
  { key: 'branching', label: '分岐' },
]

/**
 * ディレクター向けトークスクリプト編集（下書き CRUD・公開）。
 */
export function TalkScriptsDirectorClient() {
  const { data: session, status } = useSession()
  const token = session?.accessToken ?? ''

  const [scriptType, setScriptType] = useState<TalkScriptType>('linear')
  const [drafts, setDrafts] = useState<{ id: string; label: string }[]>([])
  const [published, setPublished] = useState<{ id: string; label: string }[]>([])
  const [selectedDraftId, setSelectedDraftId] = useState('')
  const [label, setLabel] = useState('')
  const [blocks, setBlocks] = useState(defaultLinearTalkScriptContent().blocks)
  const [branchJson, setBranchJson] = useState(
    () => JSON.stringify(defaultBranchingTalkScriptContent(), null, 2),
  )
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const reloadLists = useCallback(async () => {
    if (!token) return
    setStatusMsg(null)
    try {
      const [d, p] = await Promise.all([
        fetchTalkScriptDrafts(token, scriptType),
        fetchPublishedTalkScripts(token, scriptType),
      ])
      setDrafts(d.map((x) => ({ id: x.id, label: x.label })))
      setPublished(p.map((x) => ({ id: x.id, label: x.label })))
      setSelectedDraftId((prev) => (d.some((x) => x.id === prev) ? prev : d[0]?.id ?? ''))
    } catch {
      setDrafts([])
      setPublished([])
      setSelectedDraftId('')
      setStatusMsg('一覧の取得に失敗しました（権限またはネットワークを確認）')
    }
  }, [scriptType, token])

  useEffect(() => {
    if (status === 'authenticated' && token) void reloadLists()
  }, [reloadLists, status, token])

  useEffect(() => {
    if (!token || !selectedDraftId) {
      setLabel('')
      setBlocks(defaultLinearTalkScriptContent().blocks)
      setBranchJson(JSON.stringify(defaultBranchingTalkScriptContent(), null, 2))
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      setStatusMsg(null)
      try {
        const v = await fetchTalkScriptDraftVersion(token, selectedDraftId)
        if (cancelled) return
        setLabel(v.label)
        if (v.type === 'linear') {
          const parsed = parseTalkScriptLinear(v.content)
          setBlocks(parsed?.blocks ?? defaultLinearTalkScriptContent().blocks)
        } else {
          setBranchJson(JSON.stringify(v.content ?? defaultBranchingTalkScriptContent(), null, 2))
        }
      } catch {
        if (!cancelled) setStatusMsg('下書きの読み込みに失敗しました')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedDraftId, token])

  const handleNewDraft = async () => {
    if (!token) return
    setStatusMsg(null)
    try {
      const defL = defaultLinearTalkScriptContent()
      const defB = defaultBranchingTalkScriptContent()
      const content: Record<string, unknown> =
        scriptType === 'linear'
          ? { blocks: defL.blocks }
          : (JSON.parse(JSON.stringify(defB)) as Record<string, unknown>)
      const res = await createTalkScriptVersion(token, {
        type: scriptType,
        label: `下書き ${new Date().toLocaleString('ja-JP')}`,
        content,
      })
      await reloadLists()
      setSelectedDraftId(res.id)
      setStatusMsg('下書きを作成しました')
    } catch {
      setStatusMsg('下書き作成に失敗しました')
    }
  }

  const handleSave = async () => {
    if (!token || !selectedDraftId) return
    setStatusMsg(null)
    try {
      if (scriptType === 'linear') {
        await updateTalkScriptVersion(token, selectedDraftId, {
          label: label.trim() || '無題',
          content: {
            blocks: blocks.map((b) => ({ title: b.title, body: b.body })),
          },
        })
      } else {
        const parsed = JSON.parse(branchJson) as Record<string, unknown>
        await updateTalkScriptVersion(token, selectedDraftId, {
          label: label.trim() || '無題',
          content: parsed,
        })
      }
      setStatusMsg('保存しました')
      await reloadLists()
    } catch {
      setStatusMsg('保存に失敗しました（JSON 形式や必須フィールドを確認）')
    }
  }

  const handlePublish = async () => {
    if (!token || !selectedDraftId) return
    setStatusMsg(null)
    try {
      await publishTalkScriptVersion(token, selectedDraftId)
      setStatusMsg('公開しました（IS は公開版プルダウンから選択できます）')
      await reloadLists()
    } catch {
      setStatusMsg('公開に失敗しました')
    }
  }

  const updateBlock = (index: number, patch: Partial<{ title: string; body: string }>) => {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)))
  }

  const addBlock = () => {
    setBlocks((prev) => [...prev, { title: `章 ${prev.length + 1}`, body: '' }])
  }

  const removeBlock = (index: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index))
  }

  if (status !== 'authenticated' || !token) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        ログインが必要です。
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-zinc-900">トークスクリプト（ディレクター）</h1>
        <Link href="/dashboard" className="text-sm text-zinc-600 underline-offset-4 hover:underline">
          Overview へ
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {TYPE_TABS.map(({ key, label: lb }) => (
          <button
            key={key}
            type="button"
            onClick={() => setScriptType(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              scriptType === key ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
            }`}
          >
            {lb}
          </button>
        ))}
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">公開中</h2>
        <ul className="mt-2 list-inside list-disc text-sm text-zinc-600">
          {published.length === 0 ? <li>なし</li> : null}
          {published.map((p) => (
            <li key={p.id}>{p.label}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm text-zinc-700">
            下書き
            <select
              value={selectedDraftId}
              onChange={(e) => setSelectedDraftId(e.target.value)}
              className="mt-1 min-w-[12rem] rounded border border-zinc-300 px-2 py-1 text-zinc-900"
            >
              {drafts.length === 0 ? <option value="">（下書きなし）</option> : null}
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void handleNewDraft()}
            className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-900"
          >
            新規下書き
          </button>
        </div>

        {statusMsg ? <p className="mt-3 text-sm text-blue-800">{statusMsg}</p> : null}
        {loading ? <p className="mt-2 text-sm text-zinc-500">読込中…</p> : null}

        {selectedDraftId ? (
          <div className="mt-4 space-y-4">
            <label className="block text-sm text-zinc-700">
              ラベル
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-zinc-900"
              />
            </label>

            {scriptType === 'linear' ? (
              <div className="space-y-3">
                {blocks.map((b, idx) => (
                  <div key={`block-${idx}`} className="rounded border border-zinc-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-500">章 {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeBlock(idx)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        削除
                      </button>
                    </div>
                    <input
                      value={b.title}
                      onChange={(e) => updateBlock(idx, { title: e.target.value })}
                      className="mb-2 w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                      placeholder="見出し"
                    />
                    <textarea
                      value={b.body}
                      onChange={(e) => updateBlock(idx, { body: e.target.value })}
                      rows={4}
                      className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                      placeholder="本文"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addBlock}
                  className="rounded border border-dashed border-zinc-400 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  章を追加
                </button>
              </div>
            ) : (
              <label className="block text-sm text-zinc-700">
                分岐 JSON（nodes / startNodeId）
                <textarea
                  value={branchJson}
                  onChange={(e) => setBranchJson(e.target.value)}
                  rows={16}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 font-mono text-xs text-zinc-900"
                />
              </label>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => void handlePublish()}
                className="rounded-md border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                公開
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">下書きを作成するか、一覧を更新してください。</p>
        )}
      </section>
    </div>
  )
}
