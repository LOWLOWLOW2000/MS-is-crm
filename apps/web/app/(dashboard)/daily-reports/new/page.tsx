'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const BLOCKS = [
  { key: 'summary', label: '一日の総括' },
  { key: 'highlight', label: 'ハイライト（良かった点）' },
  { key: 'bottleneck', label: 'ボトルネック（反省点）' },
  { key: 'nextAction', label: 'ネクストアクション' },
] as const;

type BlockKey = (typeof BLOCKS)[number]['key'];

const MOCK_DRAFT: Record<BlockKey, string> = {
  summary: '本日は架電を中心に活動。接続率は目標を上回りました。',
  highlight: 'KEY接続が目標達成。アポ獲得も堅調。',
  bottleneck: '午後の架電数がやや少なめ。時間帯の見直しを検討。',
  nextAction: '明日は午前中に重点架電。再架電リストを優先。',
};

export default function DailyReportNewPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [values, setValues] = useState<Record<BlockKey, string>>(MOCK_DRAFT);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  if (status !== 'authenticated' || !session?.user) {
    return <div className="p-4">読み込み中...</div>;
  }

  const handleSaveDraft = () => setToast('下書きを保存しました。');
  const handleSubmit = () => setToast('提出しました。（外部連携は未実装）');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">日報 編集</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            下書き保存
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            提出
          </button>
        </div>
      </div>

      {toast && (
        <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{toast}</div>
      )}

      <div className="space-y-4 rounded border border-slate-200 bg-white p-4">
        {BLOCKS.map(({ key, label }) => (
          <div key={key}>
            <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
            <textarea
              value={values[key]}
              onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
              rows={3}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-500">
        <Link href="/dashboard/daily-reports" className="text-blue-600 hover:underline">
          ← 日報一覧に戻る
        </Link>
      </p>
    </div>
  );
}
