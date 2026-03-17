'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRecallListStore } from '@/lib/stores/recall-list-store'

/**
 * 架電結果の選択肢（汎用11種のみ）。選択した値がそのままAPIに保存される。docs/dip-mvp-spec.md §5
 */
const RESULT_OPTIONS: { value: string; label: string }[] = [
  { value: '担当者あり興味', label: '担当者あり興味' },
  { value: '担当者あり不要', label: '担当者あり不要' },
  { value: '不在', label: '不在' },
  { value: '番号違い', label: '番号違い' },
  { value: '断り', label: '断り' },
  { value: '折り返し依頼', label: '折り返し依頼' },
  { value: '留守電', label: '留守電' },
  { value: '資料送付', label: '資料送付' },
  { value: 'アポ', label: 'アポ' },
  { value: 'リスト除外', label: 'リスト除外' },
  { value: '不通', label: '不通' },
]

/** 行動結果ごとのメモ雛形（上段に固定表示）。 */
const MEMO_PRESETS: Record<string, string> = {
  '担当者あり興味': '【担当者あり興味】\n用件：\n次回：',
  '担当者あり不要': '【担当者あり不要】\n理由：\n次回：',
  '不在': '【不在】\n訪問/架電日時：\n対応：',
  '番号違い': '【番号違い】\n',
  '断り': '【断り】\n理由：\n次回：',
  '折り返し依頼': '【折り返し依頼】\n希望日時：\n用件：',
  '留守電': '【留守電】\n日時：\n用件：\n折返し希望：',
  '資料送付': '【資料送付】\n送付日：\n資料名：',
  'アポ': '【アポ】\n日時：\n場所：',
  'リスト除外': '【リスト除外】\n理由：',
  '不通': '【不通】\n',
  '': '',
}

/** 資料セット（Tier2レイヤーで管理。サンプル）。 */
const MATERIAL_SET_OPTIONS = ['契約書類', '提案書', 'カタログ', '見積書', 'その他']

/** 資料：送付方法（上からメール・FAX・郵送。案件管理職パネルで自動設定可能）。 */
const DELIVERY_METHODS = ['メール', 'FAX', '郵送'] as const

type ThreadItemType = 'text' | 'image' | 'pdf'
type ThreadSource = 'self' | 'company'

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
}

/** 履歴エリアの初期表示用サンプル（自分・企業の色分けとアポ赤の確認用）。 */
const INITIAL_THREAD: ThreadItem[] = [
  {
    id: 'sample-self-1',
    type: 'text',
    content: '折返し希望あり。明日AMで再架電',
    datetime: '2025-03-06 10:30',
    actionResult: '留守電call',
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
  {
    id: 'sample-appo-1',
    type: 'text',
    content: '3/10 14:00 本社で商談',
    datetime: '2025-03-06 11:00',
    actionResult: 'アポ',
    summary: '3/10 14:00 本社で商談',
    source: 'self',
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
  /** 架電リストからの直リンク先（未指定時は /sales-room） */
  pageLink?: string
}

/**
 * 企業詳細の下。行動結果は汎用11種のみ。選択した値がそのまま保存される。再架電は日時指定で架電リストに格納。
 */
export function SalesRoomActionResultPanel({ companyName = '（現在の企業）', pageLink = '/sales-room' }: SalesRoomActionResultPanelProps) {
  const { data: session } = useSession()
  const userName = session?.user?.name ?? '（担当者）'
  const addRecall = useRecallListStore((s) => s.add)

  /** ハイドレーション回避: 日時はクライアントマウント後にのみ生成（サーバーとクライアントで new Date() がずれるため） */
  const [headerLine, setHeaderLine] = useState('— （担当者）')

  const [action, setAction] = useState('')
  const [memoText, setMemoText] = useState('')
  const [pendingFiles, setPendingFiles] = useState<{ type: ThreadItemType; name: string }[]>([])
  const [thread, setThread] = useState<ThreadItem[]>(INITIAL_THREAD)
  const [deliveryMethod, setDeliveryMethod] = useState<string>('')
  const [materialSet, setMaterialSet] = useState<string>('')
  const [appoDateTime, setAppoDateTime] = useState('')
  const [appoPlace, setAppoPlace] = useState('')
  const [recallDate, setRecallDate] = useState('')
  const [recallTime, setRecallTime] = useState('')
  const [recallPopupOpen, setRecallPopupOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

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

  /** 行動結果を変えたら入力欄は空に（テンプレは上段で更新される）。 */
  useEffect(() => {
    setMemoText('')
  }, [action])

  const handleSend = () => {
    const now = new Date().toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\//g, '-')
    const actionLabel = RESULT_OPTIONS.find((o) => o.value === action)?.label ?? action

    const parts: string[] = [templateBlock]
    if (action === '資料送付' && (deliveryMethod || materialSet)) {
      parts.push(`送付：${deliveryMethod || '―'}　資料セット：${materialSet || '―'}`)
    }
    if (action === 'アポ' && (appoDateTime || appoPlace)) {
      parts.push(`日時：${appoDateTime || '―'}　場所：${appoPlace || '―'}`)
    }
    if (memoText.trim()) parts.push(memoText.trim())

    const fullContent = parts.join('\n')
    const summary = fullContent.split(/\n/)[0].slice(0, 60) || actionLabel

    const newItems: ThreadItem[] = [{
      id: `t-${Date.now()}-1`,
      type: 'text',
      content: fullContent,
      datetime: now,
      actionResult: actionLabel,
      summary,
      source: 'self',
    }]
    pendingFiles.forEach((f, i) => {
      newItems.push({
        id: `t-${Date.now()}-${i + 2}`,
        type: f.type,
        content: '',
        fileName: f.name,
        datetime: now,
        actionResult: actionLabel,
        summary: f.name,
        source: 'self',
      })
    })

    setThread((prev) => [...prev, ...newItems])
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
    action === '折り返し依頼'

  return (
    <section
      className="mt-4 rounded-md border border-gray-200 border-t-2 border-t-blue-100 bg-white p-4"
      aria-label="行動結果・メモ"
    >
      <h3 className="mb-3 text-sm font-semibold text-gray-900">行動結果・メモ</h3>

      <fieldset className="mb-4 flex flex-wrap gap-3" role="radiogroup" aria-label="行動結果">
        {RESULT_OPTIONS.map(({ value, label }) => (
          <label key={value} className="flex cursor-pointer items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="action-result"
              value={value}
              checked={action === value}
              onChange={() => setAction(value)}
              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700">{label}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-row-reverse gap-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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

          {/* 再架電：日時指定 → ポップアップでセット → 架電リストに格納 */}
          {action === '折り返し依頼' && (
            <div className="mt-3 rounded-md border border-gray-200 bg-gray-50/50 p-3">
              <button
                type="button"
                onClick={() => setRecallPopupOpen(true)}
                className="rounded border border-blue-500 bg-white px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
              >
                日時を指定して架電リストに追加
              </button>
              {recallPopupOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
                  aria-modal="true"
                  role="dialog"
                  aria-label="再架電日時指定"
                >
                  <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                    <h4 className="mb-3 text-sm font-semibold text-gray-900">再架電の日時を指定</h4>
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
                        onClick={() => {
                          setRecallPopupOpen(false)
                          setRecallDate('')
                          setRecallTime('')
                        }}
                        className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        キャンセル
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
            <button
              type="button"
              onClick={handleSend}
              disabled={!hasContent}
              className="ml-auto rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
            >
              送信
            </button>
          </div>
        </div>

        {/* スレッド：看板形式・下に溜まる・左サイドで下までスクロール */}
        <aside
          className="flex h-[240px] w-72 shrink-0 flex-col overflow-hidden rounded-md border border-gray-200 bg-gray-50"
          aria-label="メモ・メール履歴・企業アカウント履歴"
        >
          <div className="flex-1 overflow-y-auto p-2">
            {thread.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400">
                自分が連絡したメモ・メール履歴、企業アカウントの履歴が日時・行動結果・概要で表示されます
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {thread.map((item) => {
                  const isAppo = item.actionResult === 'アポ'
                  const isSelf = item.source === 'self'
                  const rowBg = isAppo
                    ? 'border-l-4 border-l-red-500 bg-red-50/80'
                    : isSelf
                      ? 'border-l-4 border-l-blue-400 bg-blue-50/50'
                      : 'border-l-4 border-l-emerald-500 bg-emerald-50/50'
                  return (
                    <li
                      key={item.id}
                      className={`rounded border border-gray-200 p-2 text-left text-sm shadow-sm ${rowBg}`}
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-gray-500">
                        <span>{item.datetime}</span>
                        <span className="font-medium text-gray-700">{item.actionResult}</span>
                      </div>
                      <p className={`mt-0.5 break-words ${isAppo ? 'text-red-900 font-medium' : 'text-gray-800'}`}>
                        {item.summary}
                      </p>
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
