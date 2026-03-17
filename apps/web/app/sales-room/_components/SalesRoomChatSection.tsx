'use client'

import { useState } from 'react'
import { Help, Send } from '@carbon/icons-react'

const MOCK_MESSAGES = [
  { id: '1', from: 'ディレクター', text: '本日の優先リストを更新しました。再架電を優先してください。', time: '10:00' },
  { id: '2', from: '自分', text: '承知しました。', time: '10:02' },
  { id: '3', from: 'IS・田中', text: '山田商事のフォロー、誰か対応お願いします。', time: '10:15' },
]

/**
 * 営業ルーム左カラム: PJ内チャット ＋ ヘルプボタン。
 * 電光掲示板エリアを除いた、旧「通話待機中」エリアの代替。
 */
export function SalesRoomChatSection() {
  const [input, setInput] = useState('')

  return (
    <section className="flex shrink-0 flex-col border-b border-gray-200 bg-white" aria-label="PJ内チャット">
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-gray-800">PJ内チャット</h2>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          aria-label="ヘルプ"
        >
          <Help size={14} />
          ヘルプ
        </button>
      </div>
      <div className="flex min-h-[180px] max-h-[220px] flex-1 flex-col overflow-hidden">
        <ul className="flex-1 overflow-y-auto p-2 space-y-2">
          {MOCK_MESSAGES.map((m) => (
            <li key={m.id} className="text-xs">
              <span className="font-medium text-gray-600">{m.from}</span>
              <span className="ml-1.5 text-gray-400">{m.time}</span>
              <p className="mt-0.5 text-gray-800">{m.text}</p>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 border-t border-gray-200 p-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力..."
            className="min-w-0 flex-1 rounded border border-gray-300 px-2.5 py-1.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            className="shrink-0 rounded bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
            aria-label="送信"
            disabled={!input.trim()}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </section>
  )
}
