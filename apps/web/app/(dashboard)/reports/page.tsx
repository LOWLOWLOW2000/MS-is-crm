'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchReportByMember, fetchReportSummary } from '@/lib/calling-api';
import type { ReportByMember, ReportPeriod, ReportSummary } from '@/lib/types';
import { RoleBadge } from '../_components/role-badge';

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

const formatDateForFilename = (): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}`;
};

const escapeCsvCell = (value: string): string => {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const ReportsPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [period, setPeriod] = useState<ReportPeriod>('daily');
  const [summary, setSummary] = useState<ReportSummary>(initialSummary);
  const [byMember, setByMember] = useState<ReportByMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('レポートを読み込み中です…。');

  const handleExportCsv = (): void => {
    const rows: string[][] = [
      ['period', summary.period],
      ['startAt', summary.startAt],
      ['endAt', summary.endAt],
      ['totalCalls', String(summary.totalCalls)],
      ['connectedRate', String(summary.connectedRate)],
      [],
      ['result', 'count'],
      ...summary.resultBreakdown.map((item) => [item.result, String(item.count)]),
    ];

    const csv = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const filename = `reports-${summary.period}-${formatDateForFilename()}.csv`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
      setStatusMessage(`CSVを出力しました。（${filename}）`);
  };

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
        const [nextSummary, nextByMember] = await Promise.all([
          fetchReportSummary(session.accessToken, period),
          fetchReportByMember(session.accessToken, period),
        ]);
        setSummary(nextSummary);
        setByMember(nextByMember);
        if (nextSummary.totalCalls === 0) {
          setStatusMessage('対象期間のレポート対象データがありません。');
        } else {
          setStatusMessage('レポートを更新しました。');
        }
      } catch {
        setStatusMessage('レポートの取得に失敗しました。');
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
        <header className="flex flex-col gap-4 rounded border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">基本レポート</h1>
              <p className="text-sm text-slate-600">日次・週次・月次の架電集計。</p>
              <RoleBadge role={session.user.role} name={session.user.name ?? undefined} />
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
          <button
            type="button"
            onClick={handleExportCsv}
            className="mt-3 rounded bg-emerald-600 px-3 py-2 text-xs text-white"
          >
            CSVエクスポート
          </button>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">架電件数（コール数）</h2>
            <p className="mt-2 text-2xl font-bold">
              {isLoading ? '...' : `${summary.totalCalls}件`}
            </p>
          </article>
          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">コンタクト数</h2>
            <p className="mt-2 text-2xl font-bold">
              {isLoading
                ? '...'
                : `${summary.resultBreakdown
                    .filter(
                      (r) =>
                        r.result === '担当者あり興味' || r.result === '担当者あり不要',
                    )
                    .reduce((acc, r) => acc + r.count, 0)}件`}
            </p>
          </article>
          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">アポ数</h2>
            <p className="mt-2 text-2xl font-bold">
              {isLoading
                ? '...'
                : `${summary.resultBreakdown.find((r) => r.result === '担当者あり興味')?.count ?? 0}件`}
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

        {session.user.role !== 'is_member' && byMember && (
          <section className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">ISメンバー別実績</h2>
            <p className="mt-1 text-xs text-slate-500">同じ集計期間でのメンバー別架電数・接続率</p>
            <div className="mt-3 overflow-x-auto rounded border border-slate-200">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                    <th className="px-3 py-2">名前</th>
                    <th className="px-3 py-2">メール</th>
                    <th className="px-3 py-2">架電数</th>
                    <th className="px-3 py-2">接続数</th>
                    <th className="px-3 py-2">接続率</th>
                  </tr>
                </thead>
                <tbody>
                  {byMember.members.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-slate-500">データがありません</td>
                    </tr>
                  ) : (
                    byMember.members.map((m) => (
                      <tr key={m.userId} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-medium">{m.name}</td>
                        <td className="px-3 py-2 text-slate-600">{m.email}</td>
                        <td className="px-3 py-2">{m.totalCalls}件</td>
                        <td className="px-3 py-2">{m.connectedCount}件</td>
                        <td className="px-3 py-2">{m.connectedRate}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <p className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          ステータス: {statusMessage}
        </p>
      </section>
    </main>
  );
};

export default ReportsPage;
