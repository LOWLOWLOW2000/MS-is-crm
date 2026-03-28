'use client'

import { useMemo, useState } from 'react'
import { CircleHelp } from 'lucide-react'
import { SalesRoomTalkScriptPanel } from './SalesRoomTalkScriptPanel'
import { NotionBlockEditor } from './NotionBlockEditor'
import type { ListItem } from '@/lib/types'

type RightTabKey = 'talk' | 'hp' | 'rules' | 'materials' | 'memo'

const TAB_ITEMS: { key: RightTabKey; label: string }[] = [
  { key: 'talk', label: 'トークスクリプト' },
  { key: 'hp', label: 'HP' },
  { key: 'rules', label: '案件ルール' },
  { key: 'materials', label: '案件資料' },
  { key: 'memo', label: '個人メモ帳' },
]

const HINT_LINES: { title: string; body: string }[] = [
  {
    title: 'トークスクリプト',
    body:
      'ディレクターが公開した一気通貫／分岐スクリプトを版プルダウンで表示します。架電中に同じ視野で参照する想定です（詳細編集はメインの「トーク」タブ／ディレクター画面）。',
  },
  {
    title: 'HP',
    body:
      'リストの targetUrl を埋め込み表示します。表示倍率は約 80%（拡大縮小）とし、はみ出した領域は縦横スクロールで閲覧します。',
  },
  {
    title: '案件ルール',
    body:
      'ディレクターが PJ 単位で登録するルール本文の閲覧・メモ用エリアです。本番では Slack キャンバス相当のリッチテキスト（画像・動画の差し込み可）と API 永続化を想定しています。現状はローカル保存のブロックエディタで代替。',
  },
  {
    title: '案件資料',
    body:
      'ディレクターが登録した PDF などをこの枠内で視認する想定です。アップロード・配信は API 接続後に有効化予定です。',
  },
  {
    title: '個人メモ帳',
    body:
      'PJ 内で同じ表示位置に置く個人用メモです。編集体験は案件ルールと同じブロック形式に揃え、内容は端末ローカルに保存します（本番はユーザー単位のサーバ同期を想定）。',
  },
]

const tabBtnBase =
  'rounded-t px-1.5 py-1 text-[9px] font-semibold transition-colors sm:px-2 sm:text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1'

function isSafeHpUrl(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  try {
    const u = new URL(t)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export interface CompanyDetailRightPanelProps {
  accessToken: string | undefined
  listItem: ListItem | null
  listItemId: string
}

/**
 * 企業詳細右カラム: トーク／HP／案件ルール／資料／個人メモをタブ統合。ヒントでト書きを表示。
 */
export function CompanyDetailRightPanel({
  accessToken,
  listItem,
  listItemId,
}: CompanyDetailRightPanelProps) {
  const [tab, setTab] = useState<RightTabKey>('talk')
  const [hintOpen, setHintOpen] = useState(false)

  const hpUrl = listItem?.targetUrl?.trim() ?? ''
  const hpOk = useMemo(() => isSafeHpUrl(hpUrl), [hpUrl])

  const rulesStorageKey = useMemo(
    () => `sales-room:company-rules:${listItemId || 'none'}`,
    [listItemId],
  )
  const memoStorageKey = useMemo(
    () => `sales-room:personal-memo:${listItemId || 'none'}`,
    [listItemId],
  )

  return (
    <aside className="flex min-h-[160px] min-w-0 flex-1 flex-col rounded-md border border-indigo-100 bg-indigo-50/40 px-2 py-2 text-[11px] text-gray-800 sm:basis-0 sm:flex-1">
      <div className="relative mb-1 flex min-h-0 shrink-0 flex-wrap items-center gap-1 border-b border-indigo-100 pb-1">
        <div className="flex min-w-0 flex-1 flex-wrap gap-0.5" role="tablist" aria-label="右パネル">
          {TAB_ITEMS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`${tabBtnBase} ${
                tab === key
                  ? 'border border-b-0 border-indigo-200 bg-white text-indigo-900 shadow-sm'
                  : 'border border-transparent text-indigo-800 hover:bg-white/70'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setHintOpen((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-50"
            aria-expanded={hintOpen}
            aria-label="各タブの説明（ト書き）を開く"
            title="ヒント"
          >
            <CircleHelp className="h-4 w-4" aria-hidden />
          </button>
          {hintOpen ? (
            <div
              className="absolute right-0 top-full z-20 mt-1 w-[min(100vw-2rem,20rem)] rounded-md border border-indigo-200 bg-white p-3 text-[10px] text-gray-800 shadow-lg"
              role="dialog"
              aria-label="タブのト書き"
            >
              <p className="mb-2 font-semibold text-indigo-900">ト書き（機能のねらい）</p>
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {HINT_LINES.map(({ title, body }) => (
                  <li key={title}>
                    <span className="font-semibold text-gray-900">{title}</span>
                    <span className="mt-0.5 block leading-snug text-gray-600">{body}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setHintOpen(false)}
                className="mt-2 w-full rounded border border-gray-200 py-1 text-[10px] text-gray-600 hover:bg-gray-50"
              >
                閉じる
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="mt-1 flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-indigo-100 bg-white/95 leading-relaxed"
        role="tabpanel"
      >
        {tab === 'talk' ? (
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {accessToken ? (
              <SalesRoomTalkScriptPanel accessToken={accessToken} compact />
            ) : (
              <p className="text-gray-600">ログイン後に公開スクリプトを表示します。</p>
            )}
          </div>
        ) : null}

        {tab === 'hp' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-auto p-2">
            {!hpOk ? (
              <p className="text-gray-600">
                リストに有効な URL（http/https）がないため表示できません。
              </p>
            ) : (
              <div className="flex min-h-[12rem] flex-1 flex-col overflow-auto rounded border border-gray-200 bg-gray-50">
                <p className="shrink-0 border-b border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-500">
                  約 80% 表示 · はみ出しはスクロール
                </p>
                <div className="min-h-0 flex-1 overflow-auto">
                  <div className="inline-block origin-top-left scale-[0.8]">
                    <iframe
                      title="企業 HP"
                      src={hpUrl}
                      className="block h-[min(70vh,32rem)] w-[125%] max-w-none border-0 sm:h-[36rem]"
                      sandbox="allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
                    />
                  </div>
                </div>
                <p className="shrink-0 px-2 py-1 text-[9px] text-gray-400">
                  X-Frame-Options 等により表示できないサイトがあります。
                </p>
              </div>
            )}
          </div>
        ) : null}

        {tab === 'rules' ? (
          <div className="min-h-0 flex-1 overflow-auto p-1">
            <p className="mb-1 px-1 text-[10px] text-amber-800">
              MVP: ディレクター登録 API 接続前。下記は端末ローカル保存のブロック編集（本番はリッチ編集・画像・動画を想定）。
            </p>
            <NotionBlockEditor storageKey={rulesStorageKey} title="案件ルール（ローカル下書き）" />
          </div>
        ) : null}

        {tab === 'materials' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3">
            <p className="text-[10px] text-gray-600">
              ディレクターが PJ に紐づけて登録した PDF 等を、この枠内で閲覧する想定です（ビューア API 接続予定）。
            </p>
            <div className="flex min-h-[12rem] flex-1 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50/80 p-4 text-center text-[11px] text-gray-500">
              資料が未登録です。接続後はここに PDF プレビューが表示されます。
            </div>
          </div>
        ) : null}

        {tab === 'memo' ? (
          <div className="min-h-0 flex-1 overflow-auto p-1">
            <p className="mb-1 px-1 text-[10px] text-gray-500">
              案件ルールと同じブロック形式。内容はこの端末に保存（listItem 単位）。
            </p>
            <NotionBlockEditor storageKey={memoStorageKey} title="個人メモ帳" />
          </div>
        ) : null}
      </div>
    </aside>
  )
}
