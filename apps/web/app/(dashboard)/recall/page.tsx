'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { fetchRecallList, getApiBaseUrl } from '@/lib/calling-api';
import type { CallingRecord, RecallReminderEvent } from '@/lib/types';
import { RoleBadge } from '../_components/role-badge';

const RecallPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [records, setRecords] = useState<CallingRecord[]>([]);
  const [keyword, setKeyword] = useState('');
  const [statusMessage, setStatusMessage] = useState('再架電一覧を読み込み中です…。');
  const [recallReminders, setRecallReminders] = useState<RecallReminderEvent[]>([]);

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
        if (next.length === 0) {
          setStatusMessage('再架電対象はありません。');
        } else {
          setStatusMessage(`再架電一覧を読み込みました。（${next.length}件）`);
        }
      } catch {
        setStatusMessage('再架電一覧の取得に失敗しました。');
      }
    };

    void load();
  }, [status, session?.accessToken]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.tenantId) {
      return;
    }

    const socket = io(getApiBaseUrl(), {
      transports: ['websocket'],
    });

    socket.on('recall:reminder', (event: RecallReminderEvent) => {
      if (event.tenantId !== session.user.tenantId) {
        return;
      }

      setRecallReminders((current) => [event, ...current].slice(0, 10));
      const label = event.reminderType === '5min' ? '5分前' : '2分前';
      setStatusMessage(`再架電リマインド（${label}）: ${event.companyName}`);

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(`再架電リマインド（${label}）`, {
          body: `${event.companyName} / ${new Date(event.nextCallAt).toLocaleString('ja-JP')}`,
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [status, session?.user?.tenantId]);

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

  /** 明日 00:00 のタイムスタンプ */
  const tomorrowStart = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(0, 0, 0, 0);
    return t.getTime();
  }, []);

  /** 今日かかるべき（次回架電が今日または期限超過） */
  const todayRecords = useMemo(() => {
    return filtered.filter((r) => {
      if (!r.nextCallAt) return false;
      return new Date(r.nextCallAt).getTime() < tomorrowStart;
    });
  }, [filtered, tomorrowStart]);

  /** 今後の案件（次回架電が明日以降） */
  const futureRecords = useMemo(() => {
    return filtered.filter((r) => {
      if (!r.nextCallAt) return false;
      return new Date(r.nextCallAt).getTime() >= tomorrowStart;
    });
  }, [filtered, tomorrowStart]);

  if (status !== 'authenticated' || !session?.user) {
    return <main className="p-6">読み込み中...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <section className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-col gap-4 rounded border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">再架電一覧</h1>
              <p className="text-sm text-slate-600">次回架電日時順に表示します。</p>
              <RoleBadge role={session.user.role} name={session.user.name ?? undefined} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard" className="rounded border border-slate-300 px-3 py-2 text-sm">
                ダッシュボードへ
              </Link>
              <Link href="/lists" className="rounded border border-slate-300 px-3 py-2 text-sm">
                リストで架電
              </Link>
              <Link href="/reports" className="rounded border border-slate-300 px-3 py-2 text-sm">
                レポート
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

        {recallReminders.length > 0 && (
          <section className="rounded border border-amber-200 bg-amber-50 p-3">
            <h2 className="text-xs font-semibold text-amber-800">直近のリマインド</h2>
            <ul className="mt-1 space-y-1">
              {recallReminders.slice(0, 5).map((event) => {
                const label = event.reminderType === '5min' ? '5分前' : '2分前';
                return (
                  <li key={`${event.recordId}-${event.nextCallAt}-${label}`} className="text-xs text-amber-800">
                    {label}: {event.companyName} — {new Date(event.nextCallAt).toLocaleString('ja-JP')}
                    <Link
                      href={`/calling?company=${encodeURIComponent(event.companyName)}&url=`}
                      className="ml-2 text-blue-600 underline"
                    >
                      架電
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

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
          <p className="mt-1 text-xs text-slate-500">
            今日かかるべき: {todayRecords.length}件 / 今後の案件: {futureRecords.length}件
          </p>
          <div className="mt-3 overflow-x-auto">
            {todayRecords.length > 0 && (
              <>
                <h3 className="mb-2 text-sm font-medium text-amber-700">今日かかるべき</h3>
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
                    {todayRecords.map((record) => (
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
                    ))}
                  </tbody>
                </table>
                <div className="mt-4" />
              </>
            )}
            {futureRecords.length > 0 && (
              <>
                <h3 className="mb-2 text-sm font-medium text-slate-600">今後の案件</h3>
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
                    {futureRecords.map((record) => (
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
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {filtered.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">再架電対象はありません</p>
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

export default RecallPage;
