'use client'

import { useEffect, useState } from 'react'

type ChatTab = 'pj' | 'ai'

const FOOTER_CHAT_OPEN_EVENT = 'open-footer-chat'

/** 他コンポーネントからフッターチャットを開くときに dispatch するイベント名 */
export function dispatchOpenFooterChat(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FOOTER_CHAT_OPEN_EVENT))
  }
}

/**
 * フッター中央でロールアップする PJ内チャット＆AIチャット。MockShell のフッターで使用。
 */
export function FooterChatRollup() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<ChatTab>('pj')

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener(FOOTER_CHAT_OPEN_EVENT, handler)
    return () => window.removeEventListener(FOOTER_CHAT_OPEN_EVENT, handler)
  }, [])

  return (
    <div className="relative shrink-0">
      {/* ロールアップしたパネル（オープン時） */}
      {open && (
        <div
          className="absolute bottom-full left-1/2 z-50 w-full max-w-md -translate-x-1/2 overflow-hidden rounded-t-2xl border border-b-0 border-gray-200 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
          style={{ height: 'min(360px, 50vh)' }}
        >
          <div className="flex h-full flex-col bg-gradient-to-b from-slate-50/80 to-white">
            {/* ヘッダー：タブ＋閉じる */}
            <div className="relative flex shrink-0 items-center justify-between border-b border-gray-200/80 bg-white/90 px-4 py-2.5 backdrop-blur-sm">
              <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setTab('pj')}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                    tab === 'pj'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  PJ内チャット
                </button>
                <button
                  type="button"
                  onClick={() => setTab('ai')}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                    tab === 'ai'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  AIチャット
                </button>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="閉じる"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            {/* 本文エリア */}
            <div className="flex flex-1 flex-col overflow-auto p-4">
              {tab === 'pj' ? (
                <>
                  <div className="space-y-3">
                    <div className="flex justify-start">
                      <span className="max-w-[85%] rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5 text-sm text-gray-800">
                        チームのメッセージはここに表示されます。（モック）
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <span className="max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-sm text-white">
                        返信のプレビュー
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
                    <input
                      type="text"
                      placeholder="メッセージを入力…"
                      readOnly
                      className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      送信
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-1 flex-col justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-700">AIチャット</p>
                    <p className="text-xs text-gray-500">ここにAIとの会話を表示します。（モック）</p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      placeholder="AIに質問する…"
                      readOnly
                      className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      送信
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* フッターバー：▲ PJ内チャット＆AIチャット／コモンズとマリシからのお知らせ */}
      <footer className="flex h-14 shrink-0 items-center justify-between border-t border-gray-200 bg-gradient-to-b from-gray-50 to-gray-100/90 px-4 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <span className="hidden w-1/3 shrink-0 text-xs text-gray-500 md:block" />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 font-medium text-gray-700 shadow-sm ring-1 ring-gray-200/80 transition-all hover:bg-gray-50 hover:ring-gray-300 hover:shadow md:flex-initial"
          aria-expanded={open}
          aria-label={open ? 'チャットを閉じる' : 'PJ内チャット・AIチャットを開く'}
        >
          <span
            className={`inline-block text-sm transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          >
            ▲
          </span>
          <span>{open ? '閉じる' : 'PJ内チャット＆AIチャット'}</span>
        </button>
        <span className="hidden w-1/3 shrink-0 text-right text-xs text-gray-500 md:block">
          コモンズとマリシからのお知らせ（無料枠はテキスト広告）
        </span>
      </footer>
    </div>
  )
}
