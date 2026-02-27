'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { fetchCallingSummary } from '@/lib/calling-api';
import type { CallingSummary } from '@/lib/types';
import { RoleBadge } from './role-badge';

type KpiScope = 'personal' | 'team' | 'all';
type KpiPeriod = 'day' | 'week' | 'month';

const initialSummary: CallingSummary = {
  totalCallsToday: 0,
  connectedRate: 0,
  recallScheduledCount: 0,
};

/** 電光掲示板用アイテム（企業ID・ディレクターIDから登録予定。Rule: ポジティブ・楽しい情報のみ） */
type TickerItem = {
  id: string;
  text: string;
  imageUrl?: string;
  addedBy?: string;
};

const TICKER_INTERVAL_MS = 3000;

/** MOC用: ポジティブな情報のみ流す電光掲示板のサンプル */
const MOC_TICKER_ITEMS: TickerItem[] = [
  { id: '1', text: '🎉 今月アポ達成率 120% 突破！', addedBy: 'director' },
  { id: '2', text: '✨ 〇〇社 資料請求 → 商談化', addedBy: 'enterprise' },
  { id: '3', text: '👍 チーム全体 架電数 先週比 +15%', addedBy: 'director' },
];

/** 共通ヘッダー: 案件名（PJ）・KPI・アポ/資料請求ログ。全ダッシュボードページで表示 */
export const DashboardHeader = () => {
  const { data: session, status } = useSession();
  const [summary, setSummary] = useState<CallingSummary>(initialSummary);
  const [kpiScope, setKpiScope] = useState<KpiScope>('personal');
  const [kpiPeriod, setKpiPeriod] = useState<KpiPeriod>('day');
  const [tickerItems] = useState<TickerItem[]>(MOC_TICKER_ITEMS);
  const [tickerIndex, setTickerIndex] = useState(0);
  const currentTicker = tickerItems[tickerIndex % (tickerItems.length || 1)] ?? null;

  useEffect(() => {
    if (tickerItems.length === 0) return;
    const id = setInterval(() => {
      setTickerIndex((i) => i + 1);
    }, TICKER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [tickerItems.length]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return;
    const load = async () => {
      try {
        const s = await fetchCallingSummary(session.accessToken);
        setSummary(s);
      } catch {
        setSummary(initialSummary);
      }
    };
    void load();
  }, [status, session?.accessToken]);

  /** 4枠KPI（架電数・アポ・KEY接続・資料送付）。ダミー表示用に数値入り。後でAPI/ディレクター設定と連携 */
  const kpiSlots = (() => {
    const dummy = [
      { value: 12, target: 15 },
      { value: 3, target: 5 },
      { value: 8, target: 10 },
      { value: 2, target: 3 },
    ];
    const labels = ['架電数', 'アポ', 'KEY接続', '資料送付'] as const;
    const ids = ['calls', 'apo', 'key', 'docs'] as const;
    return ids.map((id, i) => {
      const v = id === 'calls' ? summary.totalCallsToday : dummy[i].value;
      const t = id === 'calls' ? 15 : dummy[i].target;
      const value = typeof v === 'number' ? v : dummy[i].value;
      const target = t;
      const achievement = target > 0 ? Math.round((value / target) * 100) : 0;
      return {
        id,
        label: labels[i],
        value,
        target,
        achievement,
      };
    });
  })();

  if (status !== 'authenticated' || !session?.user) {
    return (
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span className="text-sm text-slate-500">読み込み中...</span>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="mx-auto max-w-7xl space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-lg font-bold text-slate-800">架電PJ</h1>
            <RoleBadge role={session.user.role} name={session.user.name ?? undefined} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded border border-slate-200 bg-slate-50 text-xs">
              {(['personal', 'team', 'all'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setKpiScope(s)}
                  className={`rounded px-2 py-1.5 ${kpiScope === s ? 'bg-slate-200 font-medium text-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {s === 'personal' ? '個人' : s === 'team' ? 'チーム' : '全体'}
                </button>
              ))}
            </div>
            <span className="text-slate-400">|</span>
            <div className="flex rounded border border-slate-200 bg-slate-50 text-xs">
              {(['day', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setKpiPeriod(p)}
                  className={`rounded px-2 py-1.5 ${kpiPeriod === p ? 'bg-slate-200 font-medium text-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {p === 'day' ? '当日' : p === 'week' ? '週' : '月'}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {kpiSlots.map((slot) => {
                const valueStr = typeof slot.value === 'number' ? `${slot.value}` : slot.value;
                const achievementNum = typeof slot.achievement === 'number' ? slot.achievement : null;
                const is100 = achievementNum === 100;
                return (
                  <span
                    key={slot.id}
                    className={`flex items-center gap-1.5 text-[11px] ${is100 ? 'text-blue-600 font-medium' : 'text-slate-500'}`}
                  >
                    <span className="shrink-0">{slot.label}</span>
                    <span className={is100 ? 'animate-pulse font-semibold' : ''}>
                      {valueStr}
                    </span>
                    <span className="text-slate-400">目標 {slot.target}</span>
                    <span className="text-slate-400">
                      {typeof slot.achievement === 'number' ? `達成${slot.achievement}%` : '達成率 —'}
                    </span>
                  </span>
                );
              })}
            </div>
            <Link
              href="/dashboard"
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              ダッシュボード
            </Link>
            <button
              type="button"
              className="rounded bg-slate-800 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              ログアウト
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded border border-slate-200 bg-slate-800 px-3 py-2">
          <span className="mr-2 shrink-0 text-[11px] font-medium text-amber-300">
            アポ・資料請求ログ（ポジティブな情報のみ・約3秒で切替・企業ID/ディレクターIDから登録予定）:
          </span>
          <div className="inline-flex min-h-[28px] items-center text-sm font-medium text-white">
            {tickerItems.length === 0 ? (
              <span className="text-slate-400">まだログはありません</span>
            ) : currentTicker ? (
              <span key={currentTicker.id} className="animate-fade-in">
                {currentTicker.text}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
};
