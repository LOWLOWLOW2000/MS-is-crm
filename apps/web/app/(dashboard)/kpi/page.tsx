'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type PeriodTab = 'day' | 'week' | 'month' | 'quarter';
type ScopeTab = 'own' | 'all';

const MOCK_KPI: Record<ScopeTab, Record<PeriodTab, { calls: number; apo: number; key: number; docs: number }>> = {
  own: { day: { calls: 12, apo: 3, key: 8, docs: 2 }, week: { calls: 58, apo: 14, key: 42, docs: 9 }, month: { calls: 220, apo: 52, key: 165, docs: 38 }, quarter: { calls: 650, apo: 155, key: 490, docs: 110 } },
  all: { day: { calls: 45, apo: 11, key: 32, docs: 8 }, week: { calls: 210, apo: 48, key: 158, docs: 35 }, month: { calls: 820, apo: 195, key: 610, docs: 142 }, quarter: { calls: 2400, apo: 580, key: 1820, docs: 420 } },
};

const GOALS = { calls: 15, apo: 5, key: 10, docs: 3 };
const PERIOD_LABELS: Record<PeriodTab, string> = { day: '日次', week: '週次', month: '月次', quarter: '3ヶ月' };
const SCOPE_LABELS: Record<ScopeTab, string> = { own: '自プロジェクト', all: '全社' };

export default function KpiPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [period, setPeriod] = useState<PeriodTab>('day');
  const [scope, setScope] = useState<ScopeTab>('own');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated' || !session?.user') return <div className="p-4">読み込み中...</div>;

  const kpi = MOCK_KPI[scope][period];
  const cards = [
    { id: 'calls', label: '架電数', value: kpi.calls, target: GOALS.calls },
    { id: 'apo', label: 'アポ', value: kpi.apo, target: GOALS.apo },
    { id: 'key', label: 'KEY接続', value: kpi.key, target: GOALS.key },
    { id: 'docs', label: '資料送付', value: kpi.docs, target: GOALS.docs },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">KPIダッシュボード</h1>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded border border-slate-200 bg-white text-sm">
          {(['day', 'week', 'month', 'quarter'] as const).map((p) => (
            <button key={p} type="button" onClick={() => setPeriod(p)} className={`rounded px-3 py-2 ${period === p ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{PERIOD_LABELS[p]}</button>
          ))}
        </div>
        <div className="flex rounded border border-slate-200 bg-white text-sm">
          {(['own', 'all'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setScope(s)} className={`rounded px-3 py-2 ${scope === s ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{SCOPE_LABELS[s]}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(({ id, label, value, target }) => (
          <div key={id} className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-500">目標 {target} / 達成 {target > 0 ? Math.round((value / target) * 100) : 0}%</p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">プロジェクト別一覧</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2 text-left font-medium text-slate-700">PJ名</th>
                <th className="px-4 py-2 text-left font-medium text-slate-700">担当</th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">架電</th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">アポ</th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">KEY接続</th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">資料送付</th>
              </tr>
            </thead>
            <tbody>
              {scope === 'own' ? (
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-2">架電PJ 2025-Q1</td>
                  <td className="px-4 py-2">{session.user.name ?? '—'}</td>
                  <td className="px-4 py-2 text-right">{kpi.calls}</td>
                  <td className="px-4 py-2 text-right">{kpi.apo}</td>
                  <td className="px-4 py-2 text-right">{kpi.key}</td>
                  <td className="px-4 py-2 text-right">{kpi.docs}</td>
                </tr>
              ) : (
                <>
                  <tr className="border-b border-slate-100">
                    <td className="px-4 py-2">架電PJ 2025-Q1</td>
                    <td className="px-4 py-2 text-slate-500">IS-A</td>
                    <td className="px-4 py-2 text-right">12</td>
                    <td className="px-4 py-2 text-right">3</td>
                    <td className="px-4 py-2 text-right">8</td>
                    <td className="px-4 py-2 text-right">2</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="px-4 py-2">PJ-B</td>
                    <td className="px-4 py-2 text-slate-500">IS-B</td>
                    <td className="px-4 py-2 text-right">18</td>
                    <td className="px-4 py-2 text-right">4</td>
                    <td className="px-4 py-2 text-right">12</td>
                    <td className="px-4 py-2 text-right">3</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
