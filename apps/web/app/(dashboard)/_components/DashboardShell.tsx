'use client';

import type { ReactNode } from 'react';
import { DashboardHeader } from './DashboardHeader';

interface DashboardShellProps {
  children: ReactNode;
}

/** 共通ヘッダー + 子コンテンツ。ダッシュボード配下の全ページで使用 */
export const DashboardShell = ({ children }: DashboardShellProps) => {
  return (
    <div className="min-h-screen bg-slate-100">
      <DashboardHeader />
      {children}
    </div>
  );
};
