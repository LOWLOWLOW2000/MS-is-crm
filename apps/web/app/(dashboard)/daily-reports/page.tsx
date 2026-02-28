'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type ReportStatus = 'draft' | 'submitted';

type ReportRow = { id: string; date: string; projectName: string; status: ReportStatus };

const MOCK_REPORTS: ReportRow[] = [
  { id: '1', date: '2025-02-27', projectName: 'PJ-A', status: 'submitted' },
  { id: '2', date: '2025-02-26', projectName: 'PJ-A', status: 'draft' },
];

export default function DailyReportsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [reports, setReports] = useState<ReportRow[]>(MOCK_REPORTS);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  if (status !== 'authenticated' || !session?.user) return <div className="p-4">読み込み中...</div>;

  const handleGenerate = () => {
    const today = new Date().toISOString().slice(0, 10);
    setReports((prev) => [{ id: String(Date.now()), date: today, projectName: 'PJ-A', status: 'draft' }, ...prev]);
    setToast('本日のAI日報ドラフトを生成しました。');
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">日報管理</h1>
      <p className="text-sm text-slate-600">今日の架電ログからAI日報ドラフトを生成し、添削・提出できます。</p>
      <button type="button" onClick={handleGenerate} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">本日のAI日報を生成</button>
      {toast && <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{toast}</div>}
      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-2 text-left font-medium text-slate-700">日付</th>
              <th className="px-4 py-2 text-left font-medium text-slate-700">案件/プロジェクト</th>
              <th className="px-4 py-2 text-left font-medium text-slate-700">ステータス</th>
              <th className="px-4 py-2 text-left font-medium text-slate-700">操作</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-4 py-2">{r.date}</td>
                <td className="px-4 py-2">{r.projectName}</td>
                <td className="px-4 py-2">{r.status === 'draft' ? '下書き' : '提出済'}</td>
                <td className="px-4 py-2">
                  <Link href={r.status === 'draft' ? `/dashboard/daily-reports/new?id=${r.id}` : '#'} className="text-blue-600 hover:underline">{r.status === 'draft' ? '編集' : '閲覧'}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
