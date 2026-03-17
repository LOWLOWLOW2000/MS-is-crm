'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Phone,
  PhoneOff,
  Microphone,
  MicrophoneOff,
  Video,
  VideoOff,
  VolumeUp,
  VolumeMute,
  User,
} from '@carbon/icons-react'

type CallState = 'idle' | 'calling' | 'active' | 'ended'

/**
 * 営業ルーム左カラム上部: 通話セクション。
 * 電話番号入力・発信・通話中コントロール（ミュート/ビデオ/スピーカー/終了）。
 */
export function SalesRoomCallSection() {
  const [callState, setCallState] = useState<CallState>('idle')
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [callDuration, setCallDuration] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCall = () => {
    if (!phoneNumber.trim()) return
    setCallState('calling')
    setTimeout(() => {
      setCallState('active')
      setCallDuration(0)
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    }, 1500)
  }

  const endCall = () => {
    setCallState('ended')
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setTimeout(() => {
      setCallState('idle')
      setCallDuration(0)
      setPhoneNumber('')
    }, 1200)
  }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="shrink-0 border-b border-gray-200 bg-white">
      <div className="relative h-44 bg-gradient-to-b from-gray-800 to-gray-700 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          {callState === 'idle' && (
            <div className="text-center text-gray-400">
              <User size={48} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">通話待機中</p>
            </div>
          )}
          {callState === 'calling' && (
            <div className="text-center text-white animate-pulse">
              <Phone size={48} className="mx-auto mb-2" />
              <p className="text-sm">発信中...</p>
            </div>
          )}
          {callState === 'active' && (
            <div className="relative w-full h-full">
              {isVideoOn ? (
                <div className="absolute inset-0 bg-gradient-to-b from-blue-900 to-blue-800">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <User size={80} className="text-white opacity-30" />
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <VideoOff size={48} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">ビデオオフ</p>
                </div>
              )}
              <div className="absolute top-2 left-2 rounded-full bg-black/50 px-3 py-1.5 text-sm text-white">
                {formatDuration(callDuration)}
              </div>
              <div className="absolute bottom-2 right-2 h-24 w-20 rounded-lg border-2 border-white/20 bg-gray-800 overflow-hidden flex items-center justify-center">
                <User size={28} className="text-white opacity-50" />
              </div>
            </div>
          )}
          {callState === 'ended' && (
            <div className="text-center text-gray-400">
              <PhoneOff size={48} className="mx-auto mb-2" />
              <p className="text-sm">通話終了</p>
            </div>
          )}
        </div>
        {callState === 'active' && (
          <div className="absolute top-2 right-2 flex items-center gap-2 rounded-full bg-red-500 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs text-white">通話中</span>
          </div>
        )}
      </div>
      <div className="p-3 space-y-3">
        {callState === 'idle' && (
          <>
            <input
              type="tel"
              placeholder="電話番号を入力"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-center"
            />
            <button
              type="button"
              onClick={startCall}
              disabled={!phoneNumber.trim()}
              className="flex w-full items-center justify-center gap-2 rounded bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Phone size={18} />
              発信
            </button>
          </>
        )}
        {(callState === 'calling' || callState === 'active') && (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className={`flex h-12 w-12 items-center justify-center rounded-full ${isMuted ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              title={isMuted ? 'ミュート解除' : 'ミュート'}
            >
              {isMuted ? <MicrophoneOff size={20} /> : <Microphone size={20} />}
            </button>
            <button
              type="button"
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`flex h-12 w-12 items-center justify-center rounded-full ${!isVideoOn ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              title={isVideoOn ? 'ビデオオフ' : 'ビデオオン'}
            >
              {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
            <button
              type="button"
              onClick={() => setIsSpeakerOn(!isSpeakerOn)}
              className={`flex h-12 w-12 items-center justify-center rounded-full ${!isSpeakerOn ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              title={isSpeakerOn ? 'スピーカーオフ' : 'スピーカーオン'}
            >
              {isSpeakerOn ? <VolumeUp size={20} /> : <VolumeMute size={20} />}
            </button>
            <button
              type="button"
              onClick={endCall}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
              title="通話終了"
            >
              <PhoneOff size={24} />
            </button>
          </div>
        )}
        {callState === 'active' && (
          <p className="text-center text-xs text-gray-500">通話先: {phoneNumber}</p>
        )}
      </div>
    </div>
  )
}
