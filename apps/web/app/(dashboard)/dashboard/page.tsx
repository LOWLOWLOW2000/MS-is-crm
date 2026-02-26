'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { fetchCallingSummary, fetchRecentHelpRequests, getApiBaseUrl } from '@/lib/calling-api';
import type { CallingHelpRequest, CallingSummary } from '@/lib/types';

const initialSummary: CallingSummary = {
  totalCallsToday: 0,
  connectedRate: 0,
  recallScheduledCount: 0,
};

const upsertHelpRequest = (
  current: CallingHelpRequest[],
  incoming: CallingHelpRequest,
): CallingHelpRequest[] => {
  const filtered = current.filter((item) => item.id !== incoming.id);
  return [incoming, ...filtered].slice(0, 20);
};

const DashboardPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [summary, setSummary] = useState<CallingSummary>(initialSummary);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [helpRequests, setHelpRequests] = useState<CallingHelpRequest[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) {
      return;
    }

    const loadDashboardData = async () => {
      setIsLoadingSummary(true);
      try {
        const [nextSummary, recentHelpRequests] = await Promise.all([
          fetchCallingSummary(session.accessToken),
          fetchRecentHelpRequests(session.accessToken),
        ]);
        setSummary(nextSummary);
        setHelpRequests(recentHelpRequests);
      } catch {
        setSummary(initialSummary);
        setHelpRequests([]);
      } finally {
        setIsLoadingSummary(false);
      }
    };

    void loadDashboardData();
  }, [status, session?.accessToken]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.tenantId) {
      return;
    }

    const socket = io(getApiBaseUrl(), {
      transports: ['websocket'],
    });

    socket.on('call:help_requested', (event: CallingHelpRequest) => {
      if (event.tenantId !== session.user.tenantId) {
        return;
      }
      setHelpRequests((current) => upsertHelpRequest(current, event));
    });

    return () => {
      socket.disconnect();
    };
  }, [status, session?.user?.tenantId]);

  if (status !== 'authenticated' || !session.user) {
    return <main className="p-6">読み込み中...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <section className="mx-auto max-w-6xl space-y-4">
        <header className="rounded border border-slate-200 bg-white p-5">
          <h1 className="text-2xl font-bold">ダッシュボード</h1>
          <p className="mt-1 text-sm text-slate-600">
            ようこそ、{session.user.name} さん（{session.user.role}）
          </p>
          <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <p>メール: {session.user.email}</p>
            <p>tenantId: {session.user.tenantId}</p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">本日のKPI</h2>
            <p className="mt-2 text-2xl font-bold">
              {isLoadingSummary ? '...' : `${summary.totalCallsToday}件`}
            </p>
            <p className="text-xs text-slate-500">架電件数（当日）</p>
          </article>
          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">接続率</h2>
            <p className="mt-2 text-2xl font-bold">
              {isLoadingSummary ? '...' : `${summary.connectedRate}%`}
            </p>
            <p className="text-xs text-slate-500">担当者接続率（当日）</p>
          </article>
          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">再架電予定</h2>
            <p className="mt-2 text-2xl font-bold">
              {isLoadingSummary ? '...' : `${summary.recallScheduledCount}件`}
            </p>
            <p className="text-xs text-slate-500">未来日時の再架電予定</p>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">主要メニュー</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/calling" className="rounded bg-blue-600 px-3 py-2 text-sm text-white">
                架電画面を開く
              </Link>
              <Link
                href="/dashboard"
                className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                ダッシュボード更新
              </Link>
            </div>
          </article>
          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">ディレクター呼出（リアルタイム）</h2>
            <div className="mt-3 space-y-2">
              {helpRequests.length === 0 ? (
                <p className="text-sm text-slate-500">現在呼出はありません。</p>
              ) : (
                helpRequests.map((request) => (
                  <div key={request.id} className="rounded border border-rose-200 bg-rose-50 p-2 text-xs">
                    <p className="font-semibold text-rose-700">
                      キュー#{request.queueNumber} {request.companyName}
                    </p>
                    <p className="text-slate-700">スクリプト: {request.scriptTab}</p>
                    <p className="text-slate-500">
                      {new Date(request.requestedAt).toLocaleString('ja-JP')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </article>
          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">アカウント操作</h2>
            <button
              type="button"
              className="mt-3 rounded bg-slate-800 px-4 py-2 text-sm text-white"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              ログアウト
            </button>
          </article>
        </section>
      </section>
    </main>
  );
};

export default DashboardPage;
