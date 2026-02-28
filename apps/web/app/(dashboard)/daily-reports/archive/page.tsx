'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type ArchiveRow = {
  date: string;
  project: string;
  calls: number;
  apo: number;
  summary: string;
};

const MOCK_ARCHIVE: ArchiveRow[] = [
  { date: '2025-02-27', project: 'PJ-A', calls: 45, apo: 3, summary: '架電中心。接続率良好。' },
  { date: '2025-02-26', project: 'PJ-A', calls: 38, apo: 2, summary: '再架電多め。' },
  { date: '2025-02-25', project: 'PJ-B', calls: 52, apo: 5, summary: 'アポ達成。' },
];

export default function DailyReportsArchivePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [projectFilter, setProjectFilter] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [rows, setRows] = useState<ArchiveRow[]>(MOCK_ARCHIVE);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated' || !session?.user) {
    return <div className="p-4">読み込み中...</div>;
  }

  const handleSearch = () => {
    let next = MOCK_ARCHIVE;
    if (projectFilter.trim()) {
      next = next.filter((r) => r.project.toLowerCase().includes(projectFilter.trim().toLowerCase()));
    }
    if (periodFrom) next = next.filter((r) => r.date >= periodFrom);
    if (periodTo) next = next.filter((r) => r.date <= periodTo);
    setRows(next);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">過去ログ検索（アーカイブ）</h1>

      <div className="flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-white p-4">
        <input
          type="text"
          placeholder="案件名"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="w-40 rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <select className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">プロジェクト（すべて）</option>
          <option value="PJ-A">PJ-A</option>
          <option value="PJ-B">PJ-B</option>
        </select>
        <input
          type="date"
          value={periodFrom}
          onChange={(e) => setPeriodFrom(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <span className="text-slate-500">～</span>
        <input
          type="date"
          value={periodTo}
          onChange={(e) => setPeriodTo(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleSearch}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          検索
        </button>
      </div>

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-2 text-left font-medium text-slate-700">日付</th>
              <th className="px-4 py-2 text-left font-medium text-slate-700">案件</th>
              <th className="px-4 py-2 text-right font-medium text-slate-700">架電数</th>
              <th className="px-4 py-2 text-right font-medium text-slate-700">アポ</th>
              <th className="px-4 py-2 text-left font-medium text-slate-700">概要</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.date}-${r.project}-${i}`}
                className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                onClick={() => alert(`詳細（モック）: ${r.date} ${r.project}`)}
              >
                <td className="px-4 py-2">{r.date}</td>
                <td className="px-4 py-2">{r.project}</td>
                <td className="px-4 py-2 text-right">{r.calls}</td>
                <td className="px-4 py-2 text-right">{r.apo}</td>
                <td className="px-4 py-2 text-slate-600">{r.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
