'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import type { CallingResultType } from '@/lib/calling-result-canonical'
import { useRecallListStore } from '@/lib/stores/recall-list-store'
import { SALES_ROOM_V2_BASE } from '@/lib/sales-room-paths'
import {
  callingResultDisplayLabel,
  callingResultRadioLabelClasses,
  callingResultThreadRowClasses,
} from '@/lib/sales-room-calling-result-ui'
import {
  SALES_ROOM_RESULT_OPTIONS,
  matchSalesRoomActionValueFromLabel,
} from '@/lib/sales-room-result-options'

/** 行動結果ラジオの表示順（「自動対応NG」は 受付NG と 不在 の間・value は 折り返し依頼 のまま） */
const SALES_ROOM_ACTION_RADIO_ORDER: CallingResultType[] = [
  'アポ',
  '資料送付',
  '再架電',
  '担当NG',
  '受付NG',
  '折り返し依頼',
  '不在',
  '未着電',
  'クレーム',
  '番号違い',
]

/** 行動結果ごとのメモ雛形（キーは DB 正規名＝ラジオ value と同一）。 */
const MEMO_PRESETS: Record<string, string> = {
  アポ: '【アポ】\n日時：\n場所：',
  資料送付: '【資料送付】\n送付日：\n資料名：',
  再架電: '【再架電】\n用件：\n次回架電日時：',
  折り返し依頼: '【折り返し依頼】\n希望日時：\n用件：',
  担当NG: '【担当NG】\n理由：\n次回：',
  受付NG: '【受付NG】\n理由：\n次回：',
  不在: '【不在】\n訪問/架電日時：\n対応：',
  未着電: '【未着電】\n状況：\n次回：\n（留守電を含む）',
  クレーム: '【クレーム】\n内容：\n対応：',
  番号違い: '【番号違い】\n',
  '': '',
}

/** 資料セット（Tier2レイヤーで管理。サンプル）。 */
const MATERIAL_SET_OPTIONS = ['契約書類', '提案書', 'カタログ', '見積書', 'その他']

/** 資料：送付方法（上からメール・FAX・郵送。案件管理職パネルで自動設定可能）。 */
const DELIVERY_METHODS = ['メール', 'FAX', '郵送'] as const

/** 送信直後の取り消し／編集に戻すの有効時間（30秒〜2分の間） */
const POST_SEND_UNDO_MS = 90 * 1000

type ThreadItemType = 'text' | 'image' | 'pdf'
type ThreadSource = 'self' | 'company'

/** スレッド行の再編集・取り消し後のフォーム復元用 */
type ThreadFormSnapshot = {
  action: string
  memoText: string
  deliveryMethod: string
  materialSet: string
  appoDateTime: string
  appoPlace: string
  pendingFiles: { type: ThreadItemType; name: string }[]
}

interface ThreadItem {
  id: string
  type: ThreadItemType
  content: string
  fileName?: string
  /** 表示用：日時・行動結果・概要・自分/企業・アポなら赤 */
  datetime: string
  actionResult: string
  summary: string
  source: ThreadSource
  formSnapshot?: ThreadFormSnapshot
}

/** 先頭から、同一送信バッチ（同一 datetime・自分）の id を列挙 */
const collectBatchIdsFromTop = (items: ThreadItem[]): string[] => {
  if (items.length === 0) return []
  const top = items[0]
  if (top.source !== 'self') return []
  const ids = [top.id]
  const dt = top.datetime
  for (let i = 1; i < items.length; i++) {
    const it = items[i]
    if (it.source === 'self' && it.datetime === dt) ids.push(it.id)
    else break
  }
  return ids
}

/** 履歴エリアの初期表示用サンプル（上＝新しい日時。自分・企業の色分けとアポ赤の確認用）。 */
const INITIAL_THREAD: ThreadItem[] = [
  {
    id: 'sample-appo-1',
    type: 'text',
    content: '3/10 14:00 本社で商談',
    datetime: '2025-03-06 11:00',
    actionResult: 'アポ',
    summary: '3/10 14:00 本社で商談',
    source: 'self',
  },
  {
    id: 'sample-self-1',
    type: 'text',
    content: '折返し希望あり。明日AMで再架電',
    datetime: '2025-03-06 10:30',
    actionResult: '未着電',
    summary: '折返し希望あり。明日AMで再架電',
    source: 'self',
  },
  {
    id: 'sample-company-1',
    type: 'text',
    content: '担当者不在のため来週火曜に再連絡希望',
    datetime: '2025-03-05 14:00',
    actionResult: '不在',
    summary: '担当者不在のため来週火曜に再連絡希望',
    source: 'company',
  },
]

/** 日付・時間・自分の名前の1行を生成（テンプレ先頭に自動挿入用）。 */
function buildHeaderLine(userName: string): string {
  const now = new Date()
  const date = now.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
  const time = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  return `${date} ${time} ${userName}`
}

export interface SalesRoomActionResultPanelProps {
  /** 架電リストに追加するときの企業名（未指定時は「現在の企業」） */
  companyName?: string
  /** 架電リストからの直リンク先（未指定時はコックピット `/sales-room/v2`） */
  pageLink?: string
}

/**
 * 企業詳細の下。行動結果は架電ルーム用10種（value は DB 正）。再架電・折り返しは日時指定で架電リストに格納。
 */
export function SalesRoomActionResultPanel({
  companyName = '（現在の企業）',
  pageLink = SALES_ROOM_V2_BASE,
}: SalesRoomActionResultPanelProps) {
  const { data: session } = useSession()
  const userName = session?.user?.name ?? '（担当者）'
  const addRecall = useRecallListStore((s) => s.add)

  /** ハイドレーション回避: 日時はクライアントマウント後にのみ生成（サーバーとクライアントで new Date() がずれるため） */
  const [headerLine, setHeaderLine] = useState('— （担当者）')

  const [action, setAction] = useState('')
  const [memoText, setMemoText] = useState('')
  const [pendingFiles, setPendingFiles] = useState<{ type: ThreadItemType; name: string }[]>([])
  const [thread, setThread] = useState<ThreadItem[]>(INITIAL_THREAD)
  const [editingBatchIds, setEditingBatchIds] = useState<string[]>([])
  const [postSendUndo, setPostSendUndo] = useState<{
    threadSnapshot: ThreadItem[]
    sentForm: ThreadFormSnapshot
    expiresAt: number
  } | null>(null)
  const [undoTick, setUndoTick] = useState(0)
  const [deliveryMethod, setDeliveryMethod] = useState<string>('')
  const [materialSet, setMaterialSet] = useState<string>('')
  const [appoDateTime, setAppoDateTime] = useState('')
  const [appoPlace, setAppoPlace] = useState('')
  const [recallDate, setRecallDate] = useState('')
  const [recallTime, setRecallTime] = useState('')
  const [recallPopupOpen, setRecallPopupOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const threadRef = useRef(thread)

  useEffect(() => {
    threadRef.current = thread
  }, [thread])

  /** 送信直後の取り消しバー：残り秒表示と期限切れで消去 */
  useEffect(() => {
    if (!postSendUndo) return
    const id = window.setInterval(() => {
      setUndoTick((n) => n + 1)
      setPostSendUndo((u) => (u && Date.now() >= u.expiresAt ? null : u))
    }, 1000)
    return () => window.clearInterval(id)
  }, [postSendUndo?.expiresAt])

  const postSendUndoSecondsLeft = useMemo(
    () =>
      postSendUndo != null
        ? Math.max(0, Math.ceil((postSendUndo.expiresAt - Date.now()) / 1000))
        : 0,
    [postSendUndo, undoTick],
  )

  /** マウント後・行動結果変更時にヘッダ行（日時＋担当者名）を更新。ハイドレーション対策でクライアント側でのみ時刻を生成。 */
  useEffect(() => {
    setHeaderLine(buildHeaderLine(userName))
  }, [userName, action])

  /** 上段に固定表示するテンプレ（日付・時間・名前＋選んだ結果の雛形）。 */
  const templateBlock = (() => {
    const preset = MEMO_PRESETS[action] ?? MEMO_PRESETS['']
    if (!preset) return headerLine
    return `${headerLine}\n${preset}`
  })()

  const buildCurrentFormSnapshot = useCallback((): ThreadFormSnapshot => {
    return {
      action,
      memoText,
      deliveryMethod,
      materialSet,
      appoDateTime,
      appoPlace,
      pendingFiles: pendingFiles.map((p) => ({ ...p })),
    }
  }, [action, memoText, deliveryMethod, materialSet, appoDateTime, appoPlace, pendingFiles])

  const applyFormSnapshot = useCallback((s: ThreadFormSnapshot) => {
    setAction(s.action)
    setMemoText(s.memoText)
    setDeliveryMethod(s.deliveryMethod)
    setMaterialSet(s.materialSet)
    setAppoDateTime(s.appoDateTime)
    setAppoPlace(s.appoPlace)
    setPendingFiles(s.pendingFiles.map((p) => ({ ...p })))
  }, [])

  const beginEditTopThreadItem = useCallback(() => {
    const items = threadRef.current
    const top = items[0]
    if (!top || top.source !== 'self' || top.type !== 'text') return
    const ids = collectBatchIdsFromTop(items)
    setEditingBatchIds(ids)
    setPostSendUndo(null)
    if (top.formSnapshot) {
      applyFormSnapshot(top.formSnapshot)
    } else {
      setAction(matchSalesRoomActionValueFromLabel(top.actionResult))
      setMemoText(top.content)
      setDeliveryMethod('')
      setMaterialSet('')
      setAppoDateTime('')
      setAppoPlace('')
      setPendingFiles([])
    }
  }, [applyFormSnapshot])

  const cancelEditMode = useCallback(() => {
    setEditingBatchIds([])
    setAction('')
    setMemoText('')
    setPendingFiles([])
    setDeliveryMethod('')
    setMaterialSet('')
    setAppoDateTime('')
    setAppoPlace('')
  }, [])

  const handleUndoSend = useCallback(() => {
    if (!postSendUndo) return
    setThread(postSendUndo.threadSnapshot)
    setPostSendUndo(null)
    setEditingBatchIds([])
  }, [postSendUndo])

  const handleReeditAfterSend = useCallback(() => {
    if (!postSendUndo) return
    setThread(postSendUndo.threadSnapshot)
    applyFormSnapshot(postSendUndo.sentForm)
    setPostSendUndo(null)
    setEditingBatchIds([])
  }, [postSendUndo, applyFormSnapshot])

  const handleSend = () => {
    const beforeThread = [...threadRef.current]
    const sentFormSnapshot = buildCurrentFormSnapshot()
    const now = new Date().toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\//g, '-')
    const actionLabel =
      SALES_ROOM_RESULT_OPTIONS.find((o) => o.value === action)?.label ?? action

    const parts: string[] = [templateBlock]
    if (action === '資料送付' && (deliveryMethod || materialSet)) {
      parts.push(`送付：${deliveryMethod || '―'}　資料セット：${materialSet || '―'}`)
    }
    if (action === 'アポ' && (appoDateTime || appoPlace)) {
      parts.push(`日時：${appoDateTime || '―'}　場所：${appoPlace || '―'}`)
    }
    if ((action === '折り返し依頼' || action === '再架電') && recallDate && recallTime) {
      parts.push(`再架電リスト予定：${recallDate} ${recallTime}`)
    }
    if (memoText.trim()) parts.push(memoText.trim())

    const fullContent = parts.join('\n')
    const summary = (() => {
      if (action === 'アポ' && (appoDateTime || appoPlace)) {
        return `日時：${appoDateTime || '―'}　場所：${appoPlace || '―'}`.slice(0, 60)
      }
      if (action === '資料送付' && (deliveryMethod || materialSet)) {
        return `送付：${deliveryMethod || '―'}　資料セット：${materialSet || '―'}`.slice(0, 60)
      }
      if ((action === '折り返し依頼' || action === '再架電') && recallDate && recallTime) {
        return `再架電：${recallDate} ${recallTime}`.slice(0, 60)
      }
      // memo がある場合は memo の先頭行を要約にする（ヘッダ行ではなく“報告内容”を優先）
      if (memoText.trim()) return memoText.trim().split(/\n/)[0].slice(0, 60)
      return fullContent.split(/\n/)[0].slice(0, 60) || actionLabel
    })()

    const newItems: ThreadItem[] = [
      {
        id: `t-${Date.now()}-1`,
        type: 'text',
        content: fullContent,
        datetime: now,
        actionResult: action,
        summary,
        source: 'self',
        formSnapshot: sentFormSnapshot,
      },
    ]
    pendingFiles.forEach((f, i) => {
      newItems.push({
        id: `t-${Date.now()}-${i + 2}`,
        type: f.type,
        content: '',
        fileName: f.name,
        datetime: now,
        actionResult: action,
        summary: f.name,
        source: 'self',
      })
    })

    const batchToRemove = editingBatchIds
    setThread((prev) => {
      const withoutEdited =
        batchToRemove.length > 0 ? prev.filter((i) => !batchToRemove.includes(i.id)) : prev
      return [...newItems, ...withoutEdited]
    })
    setPostSendUndo({
      threadSnapshot: beforeThread,
      sentForm: sentFormSnapshot,
      expiresAt: Date.now() + POST_SEND_UNDO_MS,
    })
    setEditingBatchIds([])
    setMemoText('')
    setPendingFiles([])
    if (action === '資料送付') {
      setDeliveryMethod('')
      setMaterialSet('')
    }
    if (action === 'アポ') {
      setAppoDateTime('')
      setAppoPlace('')
    }
    if (action === '折り返し依頼' || action === '再架電') {
      setRecallDate('')
      setRecallTime('')
      setRecallPopupOpen(false)
    }
  }

  const handleFileChange = (type: ThreadItemType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setPendingFiles((prev) => [...prev, { type, name: file.name }])
    e.target.value = ''
  }

  const handleAddToRecallList = () => {
    if (!recallDate || !recallTime) return
    const scheduledAt = new Date(`${recallDate}T${recallTime}:00`).getTime()
    if (Number.isNaN(scheduledAt)) return
    addRecall({ companyName, scheduledAt, pageLink })
    setRecallDate('')
    setRecallTime('')
    setRecallPopupOpen(false)
  }

  const hasContent =
    memoText.trim() !== '' ||
    pendingFiles.length > 0 ||
    (action === '資料送付' && (deliveryMethod !== '' || materialSet !== '')) ||
    (action === 'アポ' && (appoDateTime !== '' || appoPlace !== '')) ||
    action === '折り返し依頼' || action === '再架電'

  return (
    <section
      className="mt-4 rounded-md border border-gray-200 border-t-2 border-t-blue-100 bg-white p-4"
      aria-label="行動結果・メモ"
    >
      <h3 className="mb-3 text-sm font-semibold text-gray-900">行動結果・メモ</h3>

      <fieldset className="mb-4 flex flex-wrap gap-3" role="radiogroup" aria-label="行動結果">
        {SALES_ROOM_ACTION_RADIO_ORDER.map((value) => (
          <label
            key={value}
            className={`flex cursor-pointer items-center gap-2 text-sm ${callingResultRadioLabelClasses(value)}`}
          >
            <input
              type="radio"
              name="action-result"
              value={value}
              checked={action === value}
              onChange={() => {
                setAction(value)
                setMemoText('')
              }}
              className="h-4 w-4 shrink-0 border-gray-300 text-blue-600 accent-blue-600 focus:ring-offset-0"
            />
            <span className="font-medium">{callingResultDisplayLabel(value)}</span>
          </label>
        ))}
      </fieldset>

      {postSendUndo != null && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="status"
          aria-live="polite"
        >
          <span className="font-medium">送信直後（残り {postSendUndoSecondsLeft} 秒）</span>
          <button
            type="button"
            onClick={handleUndoSend}
            className="rounded border border-amber-400 bg-white px-2 py-1 text-xs font-medium hover:bg-amber-100"
          >
            取り消し
          </button>
          <button
            type="button"
            onClick={handleReeditAfterSend}
            className="rounded border border-amber-400 bg-white px-2 py-1 text-xs font-medium hover:bg-amber-100"
          >
            編集に戻す
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-row-reverse gap-3">
        <div className="flex min-h-0 min-w-0 flex-[3] basis-0 flex-col">
          {/* 上段：日付・時間・名前＋担当者ラジオの雛形（固定・クリックで消えない） */}
          <div className="rounded-t-md border border-b-0 border-gray-200 bg-gray-100/80 px-3 py-2">
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">
              {templateBlock}
            </pre>
          </div>
          {/* 下段：入力欄。プレースホルダは薄い「書く」、クリックで消える */}
          <div
            className="min-h-[100px] rounded-b-md border border-gray-200 bg-white p-3 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400"
            role="textbox"
            aria-multiline="true"
          >
            <textarea
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              placeholder="書く"
              className="min-h-[60px] w-full resize-y border-0 bg-transparent p-0 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-0"
              rows={3}
            />
          </div>

          {/* 資料送付：送付方法・資料セット */}
          {action === '資料送付' && (
            <div className="mt-3 rounded-md border border-gray-200 bg-gray-50/50 p-3">
              <p className="mb-2 text-xs text-gray-500">案件管理職パネルでメール・FAX・郵送の自動設定が可能です。</p>
              <label className="mb-3 block text-sm font-medium text-gray-700">
                送付方法
                <select
                  value={deliveryMethod}
                  onChange={(e) => setDeliveryMethod(e.target.value)}
                  aria-label="送付方法を選択"
                  className="ml-2 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">選択してください</option>
                  {DELIVERY_METHODS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </label>
              {deliveryMethod === 'メール' && (
                <div className="space-y-2 rounded border border-gray-200 bg-white p-3">
                  <label className="block text-sm text-gray-700">
                    送付先メールアドレス
                    <input
                      type="email"
                      placeholder="example@company.co.jp"
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="block text-sm text-gray-700">
                    件名
                    <input
                      type="text"
                      placeholder="資料送付のご案内"
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="block text-sm text-gray-700">
                    資料セット
                    <select
                      value={materialSet}
                      onChange={(e) => setMaterialSet(e.target.value)}
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">選択</option>
                      {MATERIAL_SET_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {deliveryMethod === 'FAX' && (
                <div className="space-y-2 rounded border border-gray-200 bg-white p-3">
                  <label className="block text-sm text-gray-700">
                    FAX番号
                    <input
                      type="tel"
                      placeholder="03-1234-5678"
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="block text-sm text-gray-700">
                    資料セット
                    <select
                      value={materialSet}
                      onChange={(e) => setMaterialSet(e.target.value)}
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">選択</option>
                      {MATERIAL_SET_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {deliveryMethod === '郵送' && (
                <div className="space-y-2 rounded border border-gray-200 bg-white p-3">
                  <label className="block text-sm text-gray-700">
                    送付先住所
                    <input
                      type="text"
                      placeholder="〒100-0001 東京都千代田区..."
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="block text-sm text-gray-700">
                    資料セット
                    <select
                      value={materialSet}
                      onChange={(e) => setMaterialSet(e.target.value)}
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">選択</option>
                      {MATERIAL_SET_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* アポ：日時・場所 */}
          {action === 'アポ' && (
            <div className="mt-3 rounded-md border border-gray-200 bg-gray-50/50 p-3">
              <p className="mb-2 text-xs text-gray-500">Tier2レイヤーで管理</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <span className="w-16 text-gray-600">日時</span>
                  <input
                    type="text"
                    value={appoDateTime}
                    onChange={(e) => setAppoDateTime(e.target.value)}
                    placeholder="例：3/10 14:00"
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 placeholder:text-gray-400"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <span className="w-16 text-gray-600">場所</span>
                  <input
                    type="text"
                    value={appoPlace}
                    onChange={(e) => setAppoPlace(e.target.value)}
                    placeholder="例：本社 会議室A"
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 placeholder:text-gray-400"
                  />
                </label>
              </div>
            </div>
          )}

          {/* 再架電・折り返し依頼：日時 → 架電リストに格納 */}
          {(action === '折り返し依頼' || action === '再架電') && (
            <div className="mt-3 rounded-md border border-gray-200 bg-gray-50/50 p-3">
              <p className="mb-2 text-xs text-gray-600">
                {action === '再架電'
                  ? '再架電の日付・時間を指定して架電リストに追加できます。'
                  : '折り返し希望の日時を指定して架電リストに追加できます。'}
              </p>
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <label className="block text-sm text-gray-700">
                  日付
                  <input
                    type="date"
                    value={recallDate}
                    onChange={(e) => setRecallDate(e.target.value)}
                    className="ml-2 rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="block text-sm text-gray-700">
                  時間
                  <input
                    type="time"
                    value={recallTime}
                    onChange={(e) => setRecallTime(e.target.value)}
                    className="ml-2 rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleAddToRecallList}
                  disabled={!recallDate || !recallTime}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  架電リストに追加
                </button>
              </div>
              <button
                type="button"
                onClick={() => setRecallPopupOpen(true)}
                className="rounded border border-blue-500 bg-white px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
              >
                大きい画面で日時を指定
              </button>
              {recallPopupOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
                  aria-modal="true"
                  role="dialog"
                  aria-label="再架電日時指定"
                >
                  <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                    <h4 className="mb-3 text-sm font-semibold text-gray-900">
                      {action === '再架電' ? '再架電の日時を指定' : '折り返しの日時を指定'}
                    </h4>
                    <div className="space-y-3">
                      <label className="block text-sm text-gray-700">
                        日付
                        <input
                          type="date"
                          value={recallDate}
                          onChange={(e) => setRecallDate(e.target.value)}
                          className="ml-2 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      </label>
                      <label className="block text-sm text-gray-700">
                        時間
                        <input
                          type="time"
                          value={recallTime}
                          onChange={(e) => setRecallTime(e.target.value)}
                          className="ml-2 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setRecallPopupOpen(false)}
                        className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        閉じる
                      </button>
                      <button
                        type="button"
                        onClick={handleAddToRecallList}
                        disabled={!recallDate || !recallTime}
                        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        架電リストに格納
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange('image', e)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => handleFileChange('pdf', e)}
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              画像を添付
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              PDFを添付
            </button>
            {pendingFiles.length > 0 && (
              <span className="text-xs text-gray-500">
                未送信: {pendingFiles.map((f) => f.name).join(', ')}
              </span>
            )}
            {editingBatchIds.length > 0 && (
              <button
                type="button"
                onClick={cancelEditMode}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                編集をやめる
              </button>
            )}
            <button
              type="button"
              onClick={handleSend}
              disabled={!hasContent}
              className="ml-auto rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
            >
              {editingBatchIds.length > 0 ? '更新' : '送信'}
            </button>
          </div>
          {editingBatchIds.length > 0 && (
            <p className="mt-1 text-xs text-blue-700">スレッド先頭のメモを編集中です。更新で上書きします。</p>
          )}
        </div>

        {/* スレッド：看板形式・上＝最新（日時降順）・左サイドでスクロール */}
        <aside
          className="flex h-[200px] min-h-0 min-w-0 flex-[1] basis-0 flex-col overflow-hidden rounded-md border border-gray-200 bg-gray-50"
          aria-label="メモ・メール履歴・企業アカウント履歴"
        >
          <div className="flex-1 overflow-y-auto p-1.5">
            {thread.length === 0 ? (
              <p className="py-3 text-center text-[11px] leading-snug text-gray-400">
                自分が連絡したメモ・メール履歴、企業アカウントの履歴が日時・行動結果で表示されます
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {thread.map((item, index) => {
                  const rowBg = callingResultThreadRowClasses(item.actionResult)
                  const showEdit =
                    index === 0 && item.source === 'self' && item.type === 'text' && editingBatchIds.length === 0
                  const summaryPreview = item.summary.trim()
                  return (
                    <li
                      key={item.id}
                      title={summaryPreview !== '' ? summaryPreview : undefined}
                      className={`rounded border border-gray-200 px-2 py-1 text-left text-[11px] leading-tight shadow-sm ${rowBg}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-1 gap-y-0">
                        <div className="min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 text-[11px] text-gray-500">
                          <span className="shrink-0">{item.datetime}</span>
                          <span className="min-w-0 truncate font-medium text-gray-700">
                            {callingResultDisplayLabel(item.actionResult as CallingResultType)}
                          </span>
                        </div>
                        {showEdit && (
                          <button
                            type="button"
                            onClick={beginEditTopThreadItem}
                            className="shrink-0 rounded border border-blue-400 bg-white px-1.5 py-0 text-[10px] font-medium leading-tight text-blue-700 hover:bg-blue-50"
                          >
                            編集
                          </button>
                        )}
                      </div>
                      {summaryPreview !== '' && (
                        <span className="sr-only">{summaryPreview}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
