'use client'

import { LifeBuoy } from 'lucide-react'
import { useCallSession } from '../_providers/CallSessionProvider'

const DTMF_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const

export interface CallSurfaceProps {
  /** ヘルプ要請押下時（親でトースト等） */
  onHelpRequest?: () => void
}

/**
 * 架電コックピット共通 UI（ステータス帯・ダイヤル操作・通話中 DTMF・モーダルパッド）。
 * 状態は CallSessionProvider（モック）に集約。Phase B でプロバイダ連携を差し込む。
 */
export function CallSurface({ onHelpRequest }: CallSurfaceProps) {
  const {
    isCallActive,
    isOnHold,
    isDialPadOpen,
    dialNumber,
    currentTarget,
    dtmfLog,
    callProviderKind,
    callProviderConfig,
    openDialPad,
    closeDialPad,
    appendDialDigit,
    clearDial,
    startCallFromDialPad,
    hangUp,
    toggleHold,
    sendDtmf,
  } = useCallSession()

  const smartEmbedUrl =
    typeof callProviderConfig?.smartEmbedUrl === 'string'
      ? callProviderConfig.smartEmbedUrl
      : ''

  const statusLabel = isCallActive ? (isOnHold ? '保留中' : '架電中') : '待機中'
  const targetText =
    currentTarget != null
      ? currentTarget.phone
        ? `${currentTarget.label} / ${currentTarget.phone}`
        : currentTarget.kind === 'persona' && currentTarget.email
          ? `${currentTarget.label} / ${currentTarget.email}`
          : `${currentTarget.label} / —`
      : '（発信先未選択）'

  return (
    <>
      <section className="w-full shrink-0 rounded-md border border-slate-500/70 bg-slate-700 px-3 py-2 shadow-sm sm:ml-auto sm:w-auto sm:max-w-2xl">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5 text-[13px] leading-snug">
            <div>
              <span className="text-slate-200/95">状況：</span>
              <span
                className={
                  isCallActive ? 'font-semibold text-green-300' : 'font-semibold text-white'
                }
              >
                {statusLabel}
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-slate-200/95">発信先：</span>
              <span className="font-semibold text-white">{targetText}</span>
            </div>
            {isCallActive && dtmfLog.length > 0 ? (
              <div className="font-mono text-[11px] text-slate-300">
                DTMF: {dtmfLog.join(' ')}
              </div>
            ) : null}
            {callProviderKind !== 'mock' ? (
              <div className="text-[10px] text-slate-400">
                プロバイダ: {callProviderKind}
                {callProviderKind === 'external_url' ? '（発信時に外部 URL を別タブで開きます）' : ''}
                {callProviderKind === 'webhook' ? '（終了通知は /webhooks/call-events を利用）' : ''}
              </div>
            ) : null}
          </div>

          <div className="mt-2 grid w-full min-w-[220px] grid-cols-2 gap-0.5 overflow-hidden rounded-md border border-slate-300 bg-slate-100 text-[11px] font-semibold sm:mt-0 sm:max-w-2xl sm:grid-cols-4">
            <button
              type="button"
              onClick={openDialPad}
              disabled={isCallActive}
              className={`flex flex-col items-center justify-center px-2 py-2 ${
                isCallActive
                  ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
              aria-label="ダイヤルパッド呼出"
            >
              <span className="mb-0.5 inline-flex h-4 w-4 items-center justify-center rounded-sm bg-white/90 text-[9px] font-bold text-emerald-700">
                ▶
              </span>
              <span className="leading-tight">ダイヤルパッド呼出</span>
            </button>

            <button
              type="button"
              onClick={toggleHold}
              disabled={!isCallActive}
              className={`flex flex-col items-center justify-center border-l border-slate-300 px-2 py-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                isOnHold ? 'bg-amber-200 text-amber-900' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <span className="mb-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white">
                ♪
              </span>
              <span className="leading-tight">保留</span>
            </button>

            <button
              type="button"
              onClick={() => onHelpRequest?.()}
              className="flex flex-col items-center justify-center border-l border-slate-300 bg-amber-200 px-2 py-2 text-amber-950 hover:bg-amber-300"
              aria-label="ヘルプ要請"
            >
              <span className="mb-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 text-white">
                <LifeBuoy className="h-2.5 w-2.5" aria-hidden />
              </span>
              <span className="leading-tight">ヘルプ要請</span>
            </button>

            <button
              type="button"
              onClick={hangUp}
              disabled={!isCallActive}
              className="flex flex-col items-center justify-center border-l border-slate-300 bg-red-600 px-2 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              aria-label="電話を切る"
            >
              <span className="mb-0.5 inline-flex h-4 w-4 items-center justify-center rounded-sm bg-white/90 text-[9px] font-bold text-red-700">
                ■
              </span>
              <span className="leading-tight">電話を切る</span>
            </button>
          </div>
        </div>

        {isCallActive ? (
          <div className="mt-2 border-t border-slate-600 pt-2">
            <p className="mb-1 text-[10px] font-medium text-slate-300">IVR / 内線（DTMF）</p>
            <div className="grid grid-cols-6 gap-0.5 sm:grid-cols-12">
              {DTMF_KEYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => sendDtmf(d)}
                  className="rounded border border-slate-500 bg-slate-600 py-1.5 text-xs font-semibold text-white hover:bg-slate-500"
                >
                  {d}
                </button>
              ))}
            </div>
            {callProviderKind === 'zoom_embed' ? (
              <div className="mt-2 rounded border border-slate-500 bg-slate-800/80 p-2">
                <p className="mb-1 text-[10px] text-slate-300">
                  Zoom Smart Embed（設定の smartEmbedUrl を表示）
                </p>
                {smartEmbedUrl.trim() ? (
                  <iframe
                    title="Zoom Smart Embed"
                    src={smartEmbedUrl}
                    className="h-40 w-full rounded border border-slate-600 bg-black"
                  />
                ) : (
                  <p className="text-[10px] text-amber-200">
                    callProviderConfig.smartEmbedUrl が未設定です（developer が settings/calling で JSON
                    設定）。
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {isDialPadOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xs rounded-lg border border-slate-300 bg-white p-4 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">ダイヤルパッド</h3>
              <button
                type="button"
                onClick={closeDialPad}
                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
              >
                閉じる
              </button>
            </div>
            <div className="mb-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-sm text-slate-900">
              {dialNumber || currentTarget?.phone || '番号を入力'}
            </div>
            <div className="grid grid-cols-3 gap-1 text-sm">
              {DTMF_KEYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => appendDialDigit(d)}
                  className="flex h-9 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50"
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={clearDial}
                className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                クリア
              </button>
              <button
                type="button"
                onClick={startCallFromDialPad}
                className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <span className="inline-block h-3 w-3 rounded-sm bg-white/90" />
                発信
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
