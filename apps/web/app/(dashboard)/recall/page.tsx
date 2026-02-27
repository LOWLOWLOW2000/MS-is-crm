'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { fetchRecallList } from '@/lib/calling-api';
import type { CallingRecord } from '@/lib/types';

const RecallPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [records, setRecords] = useState<CallingRecord[]>([]);
  const [keyword, setKeyword] = useState('');
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
      try {
        const next = await fetchRecallList(session.accessToken);
        setRecords(next);
        setStatusMessage(`再架電一覧を読み込みました（${next.length}件）`);
      } catch {
        setStatusMessage('再架電一覧の取得に失敗しました');
      }
    };

    void load();
  }, [status, session?.accessToken]);

  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return records;
    }

    return records.filter((record) => {
      return (
        record.companyName.toLowerCase().includes(normalized) ||
        record.companyPhone.toLowerCase().includes(normalized) ||
        record.result.toLowerCase().includes(normalized)
      );
    });
  }, [records, keyword]);

  const getDueLabel = (nextCallAt: string | null): string => {
    if (!nextCallAt) {
      return '-';
    }

    const nextMs = new Date(nextCallAt).getTime();
    const diffMinutes = Math.round((nextMs - Date.now()) / (1000 * 60));
    if (diffMinutes < 0) {
      return `期限超過 ${Math.abs(diffMinutes)}分`;
    }
    return `あと ${diffMinutes}分`;
  };

  if (status !== 'authenticated' || !session?.user) {
    return <main className="p-6">読み込み中...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <section className="mx-auto max-w-7xl space-y-4">
        <header className="flex items-center justify-between rounded border border-slate-200 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">再架電一覧</h1>
            <p className="text-sm text-slate-600">次回架電日時順に表示します</p>
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
          <label htmlFor="recall-keyword" className="text-sm font-medium text-slate-700">
            検索（会社名 / 電話 / 結果）
          </label>
          <input
            id="recall-keyword"
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm md:w-96"
            placeholder="株式会社 / 03-xxxx / 不在 など"
          />
        </section>

        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold">再架電対象</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="px-2 py-2">会社名</th>
                  <th className="px-2 py-2">電話番号</th>
                  <th className="px-2 py-2">前回結果</th>
                  <th className="px-2 py-2">次回架電</th>
                  <th className="px-2 py-2">期限</th>
                  <th className="px-2 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-slate-500">
                      再架電対象はありません
                    </td>
                  </tr>
                ) : (
                  filtered.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 text-xs">
                      <td className="px-2 py-2">{record.companyName}</td>
                      <td className="px-2 py-2">{record.companyPhone}</td>
                      <td className="px-2 py-2">{record.result}</td>
                      <td className="px-2 py-2">
                        {record.nextCallAt
                          ? new Date(record.nextCallAt).toLocaleString('ja-JP')
                          : '-'}
                      </td>
                      <td className="px-2 py-2">{getDueLabel(record.nextCallAt)}</td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/calling?company=${encodeURIComponent(record.companyName)}&url=${encodeURIComponent(record.targetUrl)}`}
                          className="rounded bg-blue-600 px-2 py-1 text-white"
                        >
                          架電画面へ
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          ステータス: {statusMessage}
        </p>
      </section>
    </main>
  );
};

export default RecallPage;
