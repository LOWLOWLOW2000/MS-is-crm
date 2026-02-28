'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { getNeoPointerEnabled } from '@/lib/neo-pointer-storage';
import { DashboardHeader } from './DashboardHeader';
import { DashboardNav } from './DashboardNav';
import { NeoPointerWidget } from './NeoPointerWidget';

const NEO_POINTER_SETTING_EVENT = 'neo-pointer-setting-changed';

interface DashboardShellProps {
  children: ReactNode;
}

/** 共通ヘッダー + 左ナビ + 子コンテンツ。ダッシュボード配下の全ページで使用 */
export const DashboardShell = ({ children }: DashboardShellProps) => {
  const [neoPointerEnabled, setNeoPointerEnabled] = useState(false);

  useEffect(() => {
    setNeoPointerEnabled(getNeoPointerEnabled());
    const onSettingChange = (e: Event) => {
      const ev = e as CustomEvent<boolean>;
      setNeoPointerEnabled(ev.detail ?? getNeoPointerEnabled());
    };
    window.addEventListener(NEO_POINTER_SETTING_EVENT, onSettingChange);
    return () => window.removeEventListener(NEO_POINTER_SETTING_EVENT, onSettingChange);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <DashboardHeader />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <DashboardNav />
        <main className="min-w-0 flex-1 p-4">{children}</main>
      </div>
      {neoPointerEnabled && <NeoPointerWidget />}
    </div>
  );
};
