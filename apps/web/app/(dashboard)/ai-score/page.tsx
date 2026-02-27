'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchReportAiScorecard } from '@/lib/calling-api';
import type { AiScorecardEntry } from '@/lib/types';

/** プレビュー用ダミー（近日公開表示） */
const DUMMY_ENTRIES: AiScorecardEntry[] = [
  {
    callRecordId: 'preview-1',
    tenantId: 'preview',
    companyName: '株式会社サンプルA',
    isMemberEmail: 'is@example.com',
    callDate: new Date(Date.now() - 86400000).toISOString(),
    durationSeconds: 180,
    result: '担当者あり興味',
    overallScore: null,
    evaluatedAt: null,
    evaluation: null,
  },
  {
    callRecordId: 'preview-2',
    tenantId: 'preview',
    companyName: '株式会社サンプルB',
    isMemberEmail: 'is@example.com',
    callDate: new Date(Date.now() - 172800000).toISOString(),
    durationSeconds: 90,
    result: '不在',
    overallScore: null,
    evaluatedAt: null,
    evaluation: null,
  },
];

const CATEGORY_LABELS = [
  '会話品質系',
  '受付突破系',
  'ヒアリング系',
  '反論対応系',
  'クロージング系',
  '感情・雰囲気系',
  'コンプライアンス系',
];

const AiScorePage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [entries, setEntries] = useState<AiScorecardEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<AiScorecardEntry | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (status === 'authenticated' && session?.user?.role === 'is_member') {
      router.replace('/calling');
      return;
    }
  }, [status, session?.user?.role, router]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) {
      return;
    }
    const load = async (): Promise<void> => {
      try {
        const data = await fetchReportAiScorecard(session.accessToken);
        setEntries(data.length > 0 ? data : DUMMY_ENTRIES);
      } catch {
        setEntries(DUMMY_ENTRIES);
      }
    };
    void load();
  }, [status, session?.accessToken]);

  if (status !== 'authenticated' || !session?.user) {
    return <main className="p-6">読み込み中...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <section className="mx-auto max-w-7xl space-y-4">
        <header className="flex items-center justify-between rounded border border-slate-200 bg-white p-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">AIスコアカード</h1>
              <span
                className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                title="現時点ではスコアは自動計算されません"
              >
                準備中
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              通話ごとのAI品質評価（Phase2で実装予定）
            </p>
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

        <div
          className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
          role="status"
        >
          この画面は2026年Phase2で実装予定のAI評価機能のプレビューです。現時点ではスコアは自動計算されません。ZOOM録音の一括ダウンロードとWhisper・GPTによる評価は後日提供予定です。
        </div>

        <div className="flex gap-4">
          <section className="w-1/2 min-w-0 rounded border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">通話一覧</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="px-2 py-2">通話日時</th>
                    <th className="px-2 py-2">IS</th>
                    <th className="px-2 py-2">会社名</th>
                    <th className="px-2 py-2">通話時間</th>
                    <th className="px-2 py-2">結果</th>
                    <th className="px-2 py-2">AIスコア</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-6 text-center text-slate-500">
                        通話データがありません
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr
                        key={entry.callRecordId}
                        className={`cursor-pointer border-b border-slate-100 text-xs ${
                          selectedEntry?.callRecordId === entry.callRecordId
                            ? 'bg-blue-50'
                            : 'hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedEntry(entry)}
                      >
                        <td className="px-2 py-2">
                          {new Date(entry.callDate).toLocaleString('ja-JP')}
                        </td>
                        <td className="px-2 py-2">{entry.isMemberEmail}</td>
                        <td className="px-2 py-2">{entry.companyName}</td>
                        <td className="px-2 py-2">{entry.durationSeconds}秒</td>
                        <td className="px-2 py-2">{entry.result}</td>
                        <td className="px-2 py-2 text-slate-400">
                          {entry.overallScore ?? '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="w-1/2 min-w-0 rounded border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">AI評価詳細</h2>
            {!selectedEntry ? (
              <p className="mt-4 text-sm text-slate-500">左の一覧から通話を選択してください</p>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-sm font-medium text-slate-700">
                  {selectedEntry.companyName}（{new Date(selectedEntry.callDate).toLocaleString('ja-JP')}）
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_LABELS.map((label) => (
                    <div
                      key={label}
                      className="rounded border border-slate-200 bg-slate-50 p-2 text-xs"
                    >
                      <span className="text-slate-600">{label}</span>
                      <span className="ml-2 text-slate-400">-</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-700">AI要約</h3>
                  <p className="mt-1 text-sm text-slate-500">（未解析）</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-700">改善ポイント</h3>
                  <p className="mt-1 text-sm text-slate-500">（未解析）</p>
                </div>
                <button
                  type="button"
                  disabled
                  title="近日公開"
                  className="mt-2 rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                >
                  AIで再解析
                </button>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
};

export default AiScorePage;
