'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchReportSummary } from '@/lib/calling-api';
import type { ReportPeriod, ReportSummary } from '@/lib/types';

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: 'daily', label: '日次' },
  { value: 'weekly', label: '週次（直近7日）' },
  { value: 'monthly', label: '月次（直近30日）' },
];

const initialSummary: ReportSummary = {
  period: 'daily',
  startAt: new Date().toISOString(),
  endAt: new Date().toISOString(),
  totalCalls: 0,
  connectedRate: 0,
  resultBreakdown: [],
};

const ReportsPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [period, setPeriod] = useState<ReportPeriod>('daily');
  const [summary, setSummary] = useState<ReportSummary>(initialSummary);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('待機中');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }

    if (status === 'authenticated' && session?.user?.role === 'is_member') {
      router.replace('/calling');
    }
  }, [status, session?.user?.role, router]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) {
      return;
    }

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const nextSummary = await fetchReportSummary(session.accessToken, period);
        setSummary(nextSummary);
        setStatusMessage('レポートを更新しました');
      } catch {
        setStatusMessage('レポートの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [status, session?.accessToken, period]);

  if (status !== 'authenticated' || !session?.user) {
    return <main className="p-6">読み込み中...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <section className="mx-auto max-w-6xl space-y-4">
        <header className="flex items-center justify-between rounded border border-slate-200 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">基本レポート</h1>
            <p className="text-sm text-slate-600">日次・週次・月次の架電集計</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard" className="rounded border border-slate-300 px-3 py-2 text-sm">
              ダッシュボードへ
            </Link>
            <button
              type="button"
              className="rounded bg-slate-800 px-3 py-2 text-sm text-white"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              ログアウト
            </button>
          </div>
        </header>

        <section className="rounded border border-slate-200 bg-white p-4">
          <label className="text-sm font-medium text-slate-700" htmlFor="report-period">
            集計期間
          </label>
          <select
            id="report-period"
            value={period}
            onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
            className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm md:w-80"
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            対象期間: {new Date(summary.startAt).toLocaleString('ja-JP')} -{' '}
            {new Date(summary.endAt).toLocaleString('ja-JP')}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">架電件数</h2>
            <p className="mt-2 text-2xl font-bold">
              {isLoading ? '...' : `${summary.totalCalls}件`}
            </p>
          </article>
          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">接続率</h2>
            <p className="mt-2 text-2xl font-bold">
              {isLoading ? '...' : `${summary.connectedRate}%`}
            </p>
          </article>
        </section>

        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold">結果内訳</h2>
          <div className="mt-3 space-y-2">
            {summary.resultBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500">対象データがありません。</p>
            ) : (
              summary.resultBreakdown.map((item) => (
                <div
                  key={item.result}
                  className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>{item.result}</span>
                  <span className="font-semibold">{item.count}件</span>
                </div>
              ))
            )}
          </div>
        </section>

        <p className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          ステータス: {statusMessage}
        </p>
      </section>
    </main>
  );
};

export default ReportsPage;
