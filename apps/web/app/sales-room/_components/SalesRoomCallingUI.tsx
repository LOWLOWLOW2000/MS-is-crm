'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels'
import {
  CheckmarkFilled,
  PhoneFilled,
  HelpFilled,
  Save,
  ArrowRight,
  Close,
} from '@carbon/icons-react'
import type { CallingResultType } from '@/lib/types'
import { acknowledgeSalesRoomContent, fetchCallingSettings } from '@/lib/calling-api'
import { SALES_ROOM_RESULT_OPTIONS } from '@/lib/sales-room-result-options'
import { useCallingSessionStore } from '@/lib/stores/calling-session-store'

const RIGHT_PANE_STORAGE_ID = 'sales-room-calling-right-pane'

const SCRIPT_TABS = ['受付突破', '導入トーク', '反論対応', 'ヒアリング', 'クロージング', '商品説明']

export interface SalesRoomCallingUIProps {
  companyName: string
  companyPhone?: string
  companyAddress?: string
  targetUrl?: string
  onClose?: () => void
  onNext?: () => void
}

/**
 * 営業ルーム内の架電専用UI。
 * 左: 会社情報・承認・ZOOM発信・（任意）架電を閉じる・結果・メモ・次回架電・ディレクター呼出・保存・次へ。
 * 右: 企業HP（iframe）・スクリプトタブ・BGM（react-resizable-panels で縦分割）。
 */
export function SalesRoomCallingUI({
  companyName,
  companyPhone = '03-xxxx-xxxx',
  companyAddress = '東京都〇〇区…',
  targetUrl = 'https://example.com',
  onClose,
  onNext,
}: SalesRoomCallingUIProps) {
  const { data: session, status: sessionStatus } = useSession()
  const accessToken = session?.accessToken
  const isAuthed = sessionStatus === 'authenticated' && Boolean(accessToken)

  const [localApproved, setLocalApproved] = useState(false)
  const [tenantAcked, setTenantAcked] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [ackSubmitting, setAckSubmitting] = useState(false)
  const [ackError, setAckError] = useState<string | null>(null)
  const [scriptTab, setScriptTab] = useState(SCRIPT_TABS[0])
  const [bgmVolume, setBgmVolume] = useState(30)

  useEffect(() => {
    if (!isAuthed || !accessToken) return
    let cancelled = false
    setSettingsLoading(true)
    void fetchCallingSettings(accessToken)
      .then((s) => {
        if (cancelled) return
        const at = s.salesRoomContentAckAt
        setTenantAcked(typeof at === 'string' && at.length > 0)
      })
      .catch(() => {
        if (!cancelled) setTenantAcked(false)
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, isAuthed])

  const effectiveApproved = useMemo(
    () => (isAuthed ? tenantAcked : localApproved),
    [isAuthed, localApproved, tenantAcked],
  )

  const handleApprovalAction = useCallback(async () => {
    if (!isAuthed) {
      setLocalApproved((a) => !a)
      return
    }
    if (!accessToken || tenantAcked || ackSubmitting) return
    setAckSubmitting(true)
    setAckError(null)
    try {
      const next = await acknowledgeSalesRoomContent(accessToken)
      const at = next.salesRoomContentAckAt
      setTenantAcked(typeof at === 'string' && at.length > 0)
    } catch {
      setAckError('承認の保存に失敗しました。再度お試しください。')
    } finally {
      setAckSubmitting(false)
    }
  }, [accessToken, ackSubmitting, isAuthed, tenantAcked])

  const {
    selectedResult,
    setSelectedResult,
    memo,
    setMemo,
    nextCallAt,
    setNextCallAt,
  } = useCallingSessionStore()

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: RIGHT_PANE_STORAGE_ID,
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    panelIds: ['calling-hp', 'calling-script'],
  })

  return (
    <div className="flex h-full min-h-0 flex-1 gap-0">
      <div className="flex w-[40%] min-w-0 flex-col border-r border-gray-200 bg-white">
        <div className="flex flex-1 flex-col gap-3 overflow-auto p-3">
          <div className="rounded border border-gray-200 bg-gray-50 p-2 text-sm">
            <p className="font-medium text-gray-800">{companyName}</p>
            <p className="mt-1 text-xs text-gray-600">{companyPhone}</p>
            <p className="mt-0.5 text-xs text-gray-500">{companyAddress}</p>
          </div>

          <div className="flex flex-col gap-2">
            {isAuthed && settingsLoading ? (
              <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                承認状態を確認しています…
              </p>
            ) : null}
            {isAuthed && tenantAcked ? (
              <div className="flex items-center gap-2 rounded border border-green-600 bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
                <CheckmarkFilled size={18} />
                <span>企業アカウントで内容確認済み（全員で承認ボタンは表示されません）</span>
              </div>
            ) : null}
            {(!isAuthed || (!tenantAcked && !settingsLoading)) && (
              <button
                type="button"
                onClick={() => void handleApprovalAction()}
                disabled={isAuthed && ackSubmitting}
                className={`flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm font-medium ${
                  isAuthed
                    ? 'border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60'
                    : effectiveApproved
                      ? 'border-green-600 bg-green-50 text-green-800'
                      : 'border-amber-500 bg-amber-50 text-amber-800'
                }`}
              >
                <CheckmarkFilled size={18} />
                {isAuthed
                  ? ackSubmitting
                    ? '保存中…'
                    : '内容確認・承認（テナント共通・1回で全員に反映）'
                  : `内容確認・承認 ${effectiveApproved ? '済' : '（押すと発信可）'}`}
              </button>
            )}
            {ackError ? <p className="text-xs text-red-600">{ackError}</p> : null}
            <button
              type="button"
              disabled={!effectiveApproved}
              className="flex items-center justify-center gap-2 rounded border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PhoneFilled size={18} />
              ZOOM発信
            </button>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1 self-end rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                <Close size={14} />
                架電を閉じる
              </button>
            ) : null}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">結果</label>
            <select
              value={selectedResult}
              onChange={(e) => setSelectedResult(e.target.value as CallingResultType)}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              {SALES_ROOM_RESULT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">メモ</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              placeholder="メモ"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">次回架電</label>
            <input
              type="datetime-local"
              value={nextCallAt}
              onChange={(e) => setNextCallAt(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>

          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded border border-gray-400 bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200"
          >
            <HelpFilled size={18} />
            ディレクター呼出
          </button>

          <div className="mt-auto flex gap-2 border-t border-gray-200 pt-3">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Save size={16} />
              上書き保存
            </button>
            <button
              type="button"
              onClick={onNext}
              className="flex flex-1 items-center justify-center gap-1 rounded border border-blue-600 bg-blue-50 px-2 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              次へ
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex w-[60%] min-w-0 flex-col min-h-0">
        <Group
          id={RIGHT_PANE_STORAGE_ID}
          orientation="vertical"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
          className="flex-1 min-h-0"
        >
          <Panel defaultSize={70} minSize={20}>
            <div className="flex h-full min-h-0 flex-col border-b border-gray-200">
              <div className="shrink-0 border-b border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                企業HP（INFO優先）
              </div>
              <div className="flex-1 min-h-0 bg-gray-100">
                <iframe
                  title="企業HP"
                  src={targetUrl}
                  className="h-full w-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>
          </Panel>
          <Separator className="group relative h-2 w-full shrink-0 bg-gray-200 hover:bg-blue-200 data-[resize-handle-active]:bg-blue-300">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="h-1 w-8 rounded-full bg-gray-400 group-hover:bg-blue-500 transition-colors" />
            </div>
          </Separator>
          <Panel defaultSize={30} minSize={15}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex shrink-0 flex-wrap gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1">
                {SCRIPT_TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setScriptTab(t)}
                    className={`rounded px-2 py-1 text-xs ${
                      scriptTab === t
                        ? 'bg-white font-medium text-gray-800 ring-1 ring-gray-200'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-auto bg-white p-2 text-sm text-gray-600">
                {scriptTab} のスクリプト本文をここに表示
              </div>
              <div className="shrink-0 border-t border-gray-200 px-2 py-1.5">
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  BGM
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={bgmVolume}
                    onChange={(e) => setBgmVolume(Number(e.target.value))}
                    className="w-24"
                  />
                  <span>{bgmVolume}%</span>
                </label>
              </div>
            </div>
          </Panel>
        </Group>
      </div>
    </div>
  )
}
