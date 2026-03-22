import type { ReactNode } from 'react'

/**
 * ログイン・企業登録・招待承諾など認証まわりの共通土台。
 * ページごとにクラスをコピーするとズレるため、ここで背景・ベース色・フォントを固定する。
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 antialiased">
      {children}
    </div>
  )
}
