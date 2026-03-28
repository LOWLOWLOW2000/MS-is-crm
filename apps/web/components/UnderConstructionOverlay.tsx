import type { ReactNode } from 'react'

export interface UnderConstructionOverlayProps {
  /** マスク下に表示するコンテンツ */
  children: ReactNode
  /** スクリーンリーダー向け説明 */
  ariaLabel?: string
  /** 一覧系・左メニュー対象ページ向けにマークを小さめにする */
  markSize?: 'default' | 'compact'
}

const markSizeClass: Record<'default' | 'compact', string> = {
  default:
    'pointer-events-none h-28 w-auto max-w-[min(40vw,12rem)] object-contain drop-shadow-md md:h-36',
  compact:
    'pointer-events-none h-14 w-auto max-w-[min(32vw,7rem)] object-contain drop-shadow-sm md:h-16 md:max-w-[min(28vw,8rem)]',
}

/**
 * 工事中範囲の視認用ラッパー。
 * 半透明の白マスク（不透明度 50%）と中央の工事中マークを重ねる。
 * 他ページでも同じパターンで `relative` ブロックを包めば再利用できる。
 */
export function UnderConstructionOverlay({
  children,
  ariaLabel = 'このエリアは準備中です',
  markSize = 'default',
}: UnderConstructionOverlayProps) {
  return (
    <div className="relative">
      {children}
      <div
        className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center bg-white/50"
        aria-hidden
        role="presentation"
      >
        <img
          src="/images/koujichu-mark.png"
          alt=""
          width={160}
          height={160}
          className={markSizeClass[markSize]}
        />
      </div>
      <p className="sr-only">{ariaLabel}</p>
    </div>
  )
}
