import type { ReactNode } from 'react';
import Link from 'next/link';
import { OpsNav } from './_components/OpsNav';

export default function OpsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
        <Link href="/ops" className="font-semibold text-gray-800">
          運営バックヤード
        </Link>
        <Link href="/dashboard" className="text-sm text-gray-600 hover:underline">
          メニューへ
        </Link>
      </header>
      <div className="flex min-h-0 flex-1">
        <OpsNav />
        <main className="flex min-h-0 flex-1 flex-col overflow-auto bg-gray-50 p-6">
          <article className="flex min-h-0 flex-1 flex-col" aria-label="メインコンテンツ">
            {children}
          </article>
        </main>
      </div>
      <footer className="flex h-12 shrink-0 items-center border-t border-gray-200 bg-gray-50 px-4 text-sm text-gray-500">
        運営用フッター
      </footer>
    </div>
  );
}
