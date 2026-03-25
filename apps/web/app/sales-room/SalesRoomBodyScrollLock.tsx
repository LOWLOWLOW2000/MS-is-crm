'use client'

import { useEffect } from 'react'

/**
 * 営業ルームのみ document 全体のスクロールバーを出さない（メイン・左の内部スクロールに一本化）。
 */
export const SalesRoomBodyScrollLock = () => {
  useEffect(() => {
    const html = document.documentElement
    const prevBody = document.body.style.overflow
    const prevHtml = html.style.overflow
    document.body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      html.style.overflow = prevHtml
    }
  }, [])
  return null
}
