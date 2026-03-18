'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type BlockType = 'p' | 'h1' | 'bul' | 'todo'

type Block = {
  id: string
  type: BlockType
  text: string
  checked?: boolean
}

type NotionBlockEditorProps = {
  storageKey: string
  title?: string
}

const createId = () => `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const createTemplateBlocks = (): Block[] => [
  { id: createId(), type: 'h1', text: '案件メモ（プライベート）' },
  { id: createId(), type: 'p', text: '・現状 / 課題 / 次アクションをブロックで整理' },
  { id: createId(), type: 'todo', text: '次回架電の狙いを決める', checked: false },
  { id: createId(), type: 'bul', text: '受付突破：一言目の型' },
  { id: createId(), type: 'p', text: '' },
]

const blockTypeLabel: Record<BlockType, string> = {
  p: '本文',
  h1: '見出し',
  bul: '箇条書き',
  todo: 'TODO',
}

const normalizeBlocks = (blocks: Block[]): Block[] => {
  const safe = blocks.filter((b) => b && typeof b.id === 'string' && typeof b.type === 'string')
  return safe.length > 0 ? safe : createTemplateBlocks()
}

const loadBlocks = (storageKey: string): Block[] => {
  if (typeof window === 'undefined') return createTemplateBlocks()
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return createTemplateBlocks()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return createTemplateBlocks()
    return normalizeBlocks(
      parsed.map((x) => {
        const o = x as Partial<Block>
        return {
          id: typeof o.id === 'string' ? o.id : createId(),
          type: (o.type === 'p' || o.type === 'h1' || o.type === 'bul' || o.type === 'todo') ? o.type : 'p',
          text: typeof o.text === 'string' ? o.text : '',
          checked: typeof o.checked === 'boolean' ? o.checked : undefined,
        }
      })
    )
  } catch {
    return createTemplateBlocks()
  }
}

export const NotionBlockEditor = ({ storageKey, title }: NotionBlockEditorProps) => {
  const [blocks, setBlocks] = useState<Block[]>(() => loadBlocks(storageKey))
  const [activeId, setActiveId] = useState<string>(() => blocks[0]?.id ?? '')
  const inputRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())
  const saveTimer = useRef<number | null>(null)

  const activeIndex = useMemo(() => blocks.findIndex((b) => b.id === activeId), [blocks, activeId])

  const scheduleSave = useCallback(
    (next: Block[]) => {
      if (typeof window === 'undefined') return
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          // ignore
        }
      }, 250)
    },
    [storageKey]
  )

  useEffect(() => {
    scheduleSave(blocks)
  }, [blocks, scheduleSave])

  useEffect(() => {
    return () => {
      if (saveTimer.current != null && typeof window !== 'undefined') window.clearTimeout(saveTimer.current)
    }
  }, [])

  const focusBlock = useCallback((id: string) => {
    const el = inputRefs.current.get(id)
    if (!el) return
    el.focus()
    const len = el.value.length
    el.setSelectionRange(len, len)
  }, [])

  const updateBlock = useCallback((id: string, patch: Partial<Block>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }, [])

  const insertAfter = useCallback((index: number, block: Block) => {
    setBlocks((prev) => {
      const next = [...prev]
      next.splice(index + 1, 0, block)
      return next
    })
    setActiveId(block.id)
    requestAnimationFrame(() => focusBlock(block.id))
  }, [focusBlock])

  const removeAt = useCallback((index: number) => {
    setBlocks((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((_, i) => i !== index)
      const nextId = next[Math.max(0, index - 1)]?.id ?? next[0]?.id ?? ''
      setActiveId(nextId)
      requestAnimationFrame(() => focusBlock(nextId))
      return next
    })
  }, [focusBlock])

  const mergeWithPrev = useCallback((index: number) => {
    setBlocks((prev) => {
      const cur = prev[index]
      const prevBlock = prev[index - 1]
      if (!cur || !prevBlock) return prev
      const mergedText = `${prevBlock.text}${cur.text}`
      const next = prev.map((b, i) => {
        if (i === index - 1) return { ...b, text: mergedText }
        return b
      }).filter((_, i) => i !== index)
      const id = prevBlock.id
      setActiveId(id)
      requestAnimationFrame(() => focusBlock(id))
      return next
    })
  }, [focusBlock])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    const block = blocks[index]
    if (!block) return

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      insertAfter(index, { id: createId(), type: 'p', text: '' })
      return
    }

    if (e.key === 'Backspace') {
      const el = e.currentTarget
      const isEmpty = el.value.length === 0
      const atStart = el.selectionStart === 0 && el.selectionEnd === 0
      if (isEmpty) {
        e.preventDefault()
        removeAt(index)
        return
      }
      if (atStart && index > 0) {
        e.preventDefault()
        mergeWithPrev(index)
      }
    }
  }, [blocks, insertAfter, mergeWithPrev, removeAt])

  const renderPrefix = (block: Block) => {
    if (block.type === 'bul') return <span className="mt-2 text-gray-400">•</span>
    if (block.type === 'todo') {
      return (
        <input
          type="checkbox"
          checked={Boolean(block.checked)}
          onChange={(e) => updateBlock(block.id, { checked: e.target.checked })}
          className="mt-2 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          aria-label="完了"
        />
      )
    }
    return <span className="mt-2 text-gray-400" aria-hidden> </span>
  }

  const fontClass = (t: BlockType) => {
    if (t === 'h1') return 'text-lg font-semibold tracking-tight'
    return 'text-sm'
  }

  return (
    <div className="relative overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
      {/* 背景（紙感・薄いグリッド） */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.08)_1px,transparent_0)] [background-size:18px_18px] opacity-60"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white via-white to-slate-50/60"
        aria-hidden
      />

      {/* ツールバー */}
      <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white/70 px-4 py-2 backdrop-blur">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-gray-900">{title ?? '自由メモ（案件）'}</h2>
          <p className="text-xs text-gray-500">自分のアカウント×案件に紐づくプライベートメモ（オートセーブ）</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => insertAfter(Math.max(0, activeIndex), { id: createId(), type: 'p', text: '' })}
            className="rounded border border-gray-300 bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm hover:bg-white"
          >
            ブロック追加
          </button>
          <button
            type="button"
            onClick={() => setBlocks(createTemplateBlocks())}
            className="rounded border border-gray-300 bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm hover:bg-white"
          >
            テンプレ復元
          </button>
        </div>
      </div>

      <div className="relative px-4 py-3">
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white/70 px-3 py-2 text-xs text-gray-700 backdrop-blur">
          <span className="font-medium text-gray-500">ブロック種別:</span>
          {(Object.keys(blockTypeLabel) as BlockType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                const id = blocks[activeIndex]?.id
                if (!id) return
                updateBlock(id, { type: t })
                requestAnimationFrame(() => focusBlock(id))
              }}
              className="rounded border border-gray-300 bg-white/90 px-2 py-1 text-xs font-medium text-gray-800 shadow-sm hover:bg-white"
            >
              {blockTypeLabel[t]}
            </button>
          ))}
        </div>

        <div className="space-y-1 rounded-lg border border-slate-200 bg-white/75 p-2 backdrop-blur">
          {blocks.map((b, idx) => (
            <div
              key={b.id}
              className={`group flex items-start gap-2 rounded-md px-1.5 py-1 transition-colors ${
                b.id === activeId ? 'bg-indigo-50/60' : 'hover:bg-slate-50/60'
              }`}
              onMouseDown={() => setActiveId(b.id)}
            >
              <div className="flex w-6 shrink-0 items-start justify-center">
                {renderPrefix(b)}
              </div>
              <textarea
                ref={(el) => {
                  if (!el) {
                    inputRefs.current.delete(b.id)
                    return
                  }
                  inputRefs.current.set(b.id, el)
                }}
                value={b.text}
                onFocus={() => setActiveId(b.id)}
                onChange={(e) => updateBlock(b.id, { text: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                placeholder={b.type === 'h1' ? '見出し...' : '入力...'}
                rows={b.type === 'h1' ? 1 : 1}
                className={`w-full resize-none rounded border border-transparent bg-transparent px-2 py-1 leading-relaxed text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${fontClass(b.type)}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

