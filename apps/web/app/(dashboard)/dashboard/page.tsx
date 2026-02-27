'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import {
  fetchAssignedCallingLists,
  fetchCallingSummary,
  fetchRecentHelpRequests,
  fetchRecentZoomCalls,
  getApiBaseUrl,
} from '@/lib/calling-api';
import type {
  CallingHelpRequest,
  CallingSummary,
  ListAssignedEvent,
  ListDistributedEvent,
  ListUnassignedEvent,
  RecallReminderEvent,
  ZoomCallLog,
} from '@/lib/types';

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

const mergeAssignedEvents = (
  realtime: ListAssignedEvent[],
  snapshots: ListAssignedEvent[],
): ListAssignedEvent[] => {
  const merged = [...realtime, ...snapshots].sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  const uniqueByList = new Map<string, ListAssignedEvent>();
  merged.forEach((event) => {
    if (!uniqueByList.has(event.listId)) {
      uniqueByList.set(event.listId, event);
    }
  });
  return Array.from(uniqueByList.values()).slice(0, 10);
};

const DashboardPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [summary, setSummary] = useState<CallingSummary>(initialSummary);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [helpRequests, setHelpRequests] = useState<CallingHelpRequest[]>([]);
  const [myAssignedListSnapshots, setMyAssignedListSnapshots] = useState<ListAssignedEvent[]>([]);
  const [distributedLists, setDistributedLists] = useState<ListDistributedEvent[]>([]);
  const [assignedLists, setAssignedLists] = useState<ListAssignedEvent[]>([]);
  const [recallReminders, setRecallReminders] = useState<RecallReminderEvent[]>([]);
  const [zoomCalls, setZoomCalls] = useState<ZoomCallLog[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const visibleAssignedLists = useMemo(() => {
    return mergeAssignedEvents(assignedLists, myAssignedListSnapshots);
  }, [assignedLists, myAssignedListSnapshots]);

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
        const [nextSummary, recentHelpRequests, recentZoomCalls, myAssignedLists] = await Promise.all([
          fetchCallingSummary(session.accessToken),
          fetchRecentHelpRequests(session.accessToken),
          fetchRecentZoomCalls(session.accessToken),
          fetchAssignedCallingLists(session.accessToken),
        ]);
        setSummary(nextSummary);
        setHelpRequests(recentHelpRequests);
        setZoomCalls(recentZoomCalls);
        setMyAssignedListSnapshots(
          myAssignedLists.slice(0, 10).map((list) => ({
            tenantId: list.tenantId,
            listId: list.id,
            listName: list.name,
            assigneeEmail: list.assigneeEmail ?? session.user.email ?? '',
            assignedBy: list.assignedBy ?? '-',
            assignedAt: list.assignedAt ?? list.createdAt,
          })),
        );
      } catch {
        setSummary(initialSummary);
        setHelpRequests([]);
        setZoomCalls([]);
        setMyAssignedListSnapshots([]);
      } finally {
        setIsLoadingSummary(false);
      }
    };

    void loadDashboardData();
  }, [status, session?.accessToken]);

  useEffect(() => {
    if (!('Notification' in window)) {
      return;
    }
    setNotificationPermission(window.Notification.permission);
  }, []);

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

      if (notificationPermission === 'granted') {
        new Notification('ディレクター呼出', {
          body: `${event.companyName} / ${event.scriptTab}`,
        });
      }
    });

    socket.on('recall:reminder', (event: RecallReminderEvent) => {
      if (event.tenantId !== session.user.tenantId) {
        return;
      }

      setRecallReminders((current) => [event, ...current].slice(0, 10));

      if (notificationPermission === 'granted') {
        const label = event.reminderType === '5min' ? '5分前' : '2分前';
        new Notification(`再架電リマインド（${label}）`, {
          body: `${event.companyName} / ${new Date(event.nextCallAt).toLocaleString('ja-JP')}`,
        });
      }
    });

    socket.on('list:distributed', (event: ListDistributedEvent) => {
      if (event.tenantId !== session.user.tenantId) {
        return;
      }

      setDistributedLists((current) => [event, ...current].slice(0, 10));

      if (notificationPermission === 'granted') {
        new Notification('リスト配布通知', {
          body: `${event.listName} / ${event.itemCount}件`,
        });
      }
    });

    socket.on('list:assigned', (event: ListAssignedEvent) => {
      if (event.tenantId !== session.user.tenantId) {
        return;
      }
      const sessionEmail = session.user.email?.toLowerCase() ?? '';
      if (event.assigneeEmail.toLowerCase() !== sessionEmail) {
        return;
      }

      setAssignedLists((current) => [event, ...current].slice(0, 10));
      if (notificationPermission === 'granted') {
        new Notification('リスト配布', {
          body: `${event.listName} / 配布者: ${event.assignedBy}`,
        });
      }
    });

    socket.on('list:unassigned', (event: ListUnassignedEvent) => {
      if (event.tenantId !== session.user.tenantId) {
        return;
      }
      if (!event.previousAssigneeEmail) {
        return;
      }
      const sessionEmail = session.user.email?.toLowerCase() ?? '';
      if (event.previousAssigneeEmail.toLowerCase() !== sessionEmail) {
        return;
      }
      setAssignedLists((current) => current.filter((item) => item.listId !== event.listId));
      setMyAssignedListSnapshots((current) => current.filter((item) => item.listId !== event.listId));
    });

    return () => {
      socket.disconnect();
    };
  }, [status, session?.user?.tenantId, session?.user?.email, notificationPermission]);

  const handleEnableNotification = async (): Promise<void> => {
    if (!('Notification' in window)) {
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  if (status !== 'authenticated' || !session.user) {
    return <main className="p-6">読み込み中...</main>;
  }
  const isMember = session.user.role === 'is_member';

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
          <div className="mt-3">
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-1 text-xs"
              onClick={() => {
                void handleEnableNotification();
              }}
            >
              呼出通知: {notificationPermission}
            </button>
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
              {!isMember && (
                <>
                  <Link href="/director" className="rounded bg-rose-600 px-3 py-2 text-sm text-white">
                    ディレクター画面
                  </Link>
                  <Link href="/lists" className="rounded bg-emerald-600 px-3 py-2 text-sm text-white">
                    URLリスト管理
                  </Link>
                  <Link href="/reports" className="rounded bg-violet-600 px-3 py-2 text-sm text-white">
                    基本レポート
                  </Link>
                  <Link href="/settings" className="rounded bg-amber-600 px-3 py-2 text-sm text-white">
                    設定
                  </Link>
                  <Link href="/recall" className="rounded bg-cyan-600 px-3 py-2 text-sm text-white">
                    再架電一覧
                  </Link>
                  <Link href="/scripts" className="rounded bg-indigo-600 px-3 py-2 text-sm text-white">
                    スクリプト管理
                  </Link>
                </>
              )}
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
              {helpRequests.filter((request) => request.status !== 'closed').length === 0 ? (
                <p className="text-sm text-slate-500">現在呼出はありません。</p>
              ) : (
                helpRequests
                  .filter((request) => request.status !== 'closed')
                  .map((request) => (
                  <div key={request.id} className="rounded border border-rose-200 bg-rose-50 p-2 text-xs">
                    <p className="font-semibold text-rose-700">
                      {request.status === 'waiting'
                        ? `キュー#${request.queueNumber}`
                        : '対応中'}{' '}
                      {request.companyName}
                    </p>
                    <p className="text-slate-700">IS: {request.requestedByEmail}</p>
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

        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold">再架電リマインド（5分前 / 2分前）</h2>
          <div className="mt-3 space-y-2">
            {recallReminders.length === 0 ? (
              <p className="text-sm text-slate-500">まだ通知はありません。</p>
            ) : (
              recallReminders.map((event) => (
                <div key={`${event.recordId}-${event.reminderType}`} className="rounded border border-blue-200 bg-blue-50 p-2 text-xs">
                  <p className="font-semibold text-blue-700">
                    {event.reminderType === '5min' ? '5分前' : '2分前'}: {event.companyName}
                  </p>
                  <p className="text-slate-700">
                    予定時刻: {new Date(event.nextCallAt).toLocaleString('ja-JP')}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold">ZOOM通話ログ（Webhook）</h2>
          <div className="mt-3 space-y-2">
            {zoomCalls.length === 0 ? (
              <p className="text-sm text-slate-500">まだZOOM通話ログはありません。</p>
            ) : (
              zoomCalls.map((log) => (
                <div key={log.id} className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  <p className="font-semibold text-slate-700">
                    {log.status === 'started' ? '開始' : '終了'} / {log.topic ?? '(件名なし)'}
                  </p>
                  <p className="text-slate-600">meetingId: {log.meetingId ?? '-'}</p>
                  <p className="text-slate-600">host: {log.hostEmail ?? '-'}</p>
                  <p className="text-slate-500">
                    受信: {new Date(log.receivedAt).toLocaleString('ja-JP')}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold">リスト配布通知</h2>
          <div className="mt-3 space-y-2">
            {distributedLists.length === 0 ? (
              <p className="text-sm text-slate-500">まだ配布通知はありません。</p>
            ) : (
              distributedLists.map((event) => (
                <div
                  key={`${event.listId}-${event.distributedAt}`}
                  className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs"
                >
                  <p className="font-semibold text-emerald-700">
                    {event.listName} を配布（{event.itemCount}件）
                  </p>
                  <p className="text-slate-600">
                    {new Date(event.distributedAt).toLocaleString('ja-JP')}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold">自分への配布</h2>
          <div className="mt-3 space-y-2">
            {visibleAssignedLists.length === 0 ? (
              <p className="text-sm text-slate-500">あなた宛ての配布はありません。</p>
            ) : (
              visibleAssignedLists.map((event) => (
                <div
                  key={`${event.listId}-${event.assignedAt}`}
                  className="rounded border border-cyan-200 bg-cyan-50 p-2 text-xs"
                >
                  <p className="font-semibold text-cyan-700">{event.listName} が配布されました</p>
                  <p className="text-slate-600">配布者: {event.assignedBy}</p>
                  <p className="text-slate-600">
                    {new Date(event.assignedAt).toLocaleString('ja-JP')}
                  </p>
                  <Link href={`/calling/${event.listId}`} className="mt-1 inline-block text-cyan-700 underline">
                    このリストで架電開始
                  </Link>
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
};

export default DashboardPage;
