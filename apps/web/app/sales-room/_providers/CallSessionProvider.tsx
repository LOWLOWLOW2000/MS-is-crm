'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useSession } from 'next-auth/react'
import { fetchCallingSettings } from '@/lib/calling-api'
import type { CallProviderKind } from '@/lib/types'
import type { CallSessionTarget } from '@/lib/calling/call-session-types'

export interface CallSessionContextValue {
  isCallActive: boolean
  isOnHold: boolean
  isDialPadOpen: boolean
  dialNumber: string
  currentTarget: CallSessionTarget
  dtmfLog: string[]
  callProviderKind: CallProviderKind
  callProviderConfig: Record<string, unknown> | null
  openDialPad: () => void
  closeDialPad: () => void
  appendDialDigit: (digit: string) => void
  clearDial: () => void
  startCallFromDialPad: () => void
  hangUp: () => void
  toggleHold: () => void
  setCurrentTarget: (target: CallSessionTarget) => void
  sendDtmf: (digit: string) => void
}

const CallSessionContext = createContext<CallSessionContextValue | null>(null)

const normalizeProviderKind = (raw: string | undefined): CallProviderKind => {
  if (raw === 'zoom_embed' || raw === 'external_url' || raw === 'webhook') return raw
  return 'mock'
}

/**
 * 架電 UI 共有状態。通話プロバイダ種別は settings/calling から同期（Phase B）。
 */
export function CallSessionProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [isCallActive, setIsCallActive] = useState(false)
  const [isOnHold, setIsOnHold] = useState(false)
  const [isDialPadOpen, setIsDialPadOpen] = useState(false)
  const [dialNumber, setDialNumber] = useState('')
  const [currentTarget, setCurrentTargetState] = useState<CallSessionTarget>(null)
  const [dtmfLog, setDtmfLog] = useState<string[]>([])
  const [callProviderKind, setCallProviderKind] = useState<CallProviderKind>('mock')
  const [callProviderConfig, setCallProviderConfig] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return
    let cancelled = false
    void (async () => {
      try {
        const s = await fetchCallingSettings(session.accessToken)
        if (cancelled) return
        setCallProviderKind(normalizeProviderKind(s.callProviderKind))
        setCallProviderConfig(s.callProviderConfig)
      } catch {
        if (!cancelled) {
          setCallProviderKind('mock')
          setCallProviderConfig(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session?.accessToken, status])

  const setCurrentTarget = useCallback((target: CallSessionTarget) => {
    setCurrentTargetState(target)
  }, [])

  const openDialPad = useCallback(() => {
    if (isCallActive) return
    setIsDialPadOpen(true)
  }, [isCallActive])

  const closeDialPad = useCallback(() => {
    setIsDialPadOpen(false)
  }, [])

  const appendDialDigit = useCallback((digit: string) => {
    setDialNumber((prev) => (prev + digit).slice(0, 24))
  }, [])

  const clearDial = useCallback(() => {
    setDialNumber('')
  }, [])

  const startCallFromDialPad = useCallback(() => {
    const phone = dialNumber || currentTarget?.phone || ''
    if (!phone.trim()) return
    if (callProviderKind === 'external_url') {
      const tpl =
        typeof callProviderConfig?.dialUrlTemplate === 'string'
          ? callProviderConfig.dialUrlTemplate
          : ''
      if (tpl.trim()) {
        const rawPhone = phone.replace(/-/g, '')
        const url = tpl
          .replace(/\{\{phone\}\}/g, encodeURIComponent(rawPhone))
          .replace(/\{\{phoneRaw\}\}/g, rawPhone)
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    }
    setIsCallActive(true)
    setIsOnHold(false)
    setIsDialPadOpen(false)
    setDtmfLog([])
  }, [callProviderConfig, callProviderKind, currentTarget?.phone, dialNumber])

  const hangUp = useCallback(() => {
    setIsCallActive(false)
    setIsOnHold(false)
    setDialNumber('')
    setDtmfLog([])
  }, [])

  const toggleHold = useCallback(() => {
    if (!isCallActive) return
    setIsOnHold((prev) => !prev)
  }, [isCallActive])

  const sendDtmf = useCallback(
    (digit: string) => {
      if (!isCallActive) return
      setDtmfLog((prev) => [...prev, digit].slice(-32))
    },
    [isCallActive],
  )

  const value = useMemo<CallSessionContextValue>(
    () => ({
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
      setCurrentTarget,
      sendDtmf,
    }),
    [
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
      setCurrentTarget,
      sendDtmf,
    ],
  )

  return <CallSessionContext.Provider value={value}>{children}</CallSessionContext.Provider>
}

export function useCallSession(): CallSessionContextValue {
  const ctx = useContext(CallSessionContext)
  if (!ctx) {
    throw new Error('useCallSession must be used within CallSessionProvider')
  }
  return ctx
}
