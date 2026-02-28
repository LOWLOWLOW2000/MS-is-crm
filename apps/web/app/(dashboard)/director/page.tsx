'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import {
  closeHelpRequest,
  fetchRecentHelpRequests,
  getApiBaseUrl,
  joinHelpRequest,
  sendDirectorWhisper,
} from '@/lib/calling-api';
import type { CallingHelpRequest } from '@/lib/types';

interface QueueUpdatedEvent {
  tenantId: string;
  requests: CallingHelpRequest[];
}

type HelpRequestFilter = 'all' | 'waiting' | 'joined' | 'closed';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  waiting: { label: '待機', className: 'bg-rose-100 text-rose-700' },
  joined: { label: '対応中', className: 'bg-blue-100 text-blue-700' },
  closed: { label: '完了', className: 'bg-emerald-100 text-emerald-700' },
};

const getStatusBadge = (status: string) =>
  STATUS_BADGE[status] ?? { label: status || '不明', className: 'bg-slate-100 text-slate-600' };

const formatElapsed = (startedAt: string | null, nowMs: number): string => {
  if (!startedAt) {
    return '-';
  }

  const diffMs = Math.max(nowMs - new Date(startedAt).getTime(), 0);
  const diffSec = Math.floor(diffMs / 1000);
  const minutes = Math.floor(diffSec / 60);
  const seconds = diffSec % 60;
  return `${minutes}分${seconds.toString().padStart(2, '0')}秒`;
};

const DirectorPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [requests, setRequests] = useState<CallingHelpRequest[]>([]);
  const [statusMessage, setStatusMessage] = useState('待機中');
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [filter, setFilter] = useState<HelpRequestFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [whisperByRequestId, setWhisperByRequestId] = useState<Record<string, string>>({});
  const [sendingWhisperId, setSendingWhisperId] = useState<string | null>(null);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

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
        const recent = await fetchRecentHelpRequests(session.accessToken);
        setRequests(recent);
      } catch {
        setStatusMessage('呼出履歴の取得に失敗しました。');
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

    socket.on('call:help_requested', (event: CallingHelpRequest) => {
      if (event.tenantId !== session.user.tenantId) {
        return;
      }
      setRequests((current) => [event, ...current.filter((item) => item.id !== event.id)]);
      setStatusMessage(`新規呼出: ${event.companyName}（キュー#${event.queueNumber}）`);
    });

    socket.on('director:joined', (event: { requestId: string; tenantId: string; joinedBy: string }) => {
      if (event.tenantId !== session.user.tenantId) {
        return;
      }
      setRequests((current) =>
        current.map((request) =>
          request.id === event.requestId
            ? {
                ...request,
                status: 'joined',
                joinedBy: event.joinedBy,
                joinedAt: new Date().toISOString(),
                queueNumber: 0,
              }
            : request,
        ),
      );
    });

    socket.on('call:ended', (event: { requestId: string; tenantId: string; resolvedAt: string }) => {
      if (event.tenantId !== session.user.tenantId) {
        return;
      }
      setRequests((current) =>
        current.map((request) =>
          request.id === event.requestId
            ? {
                ...request,
                status: 'closed',
                resolvedAt: event.resolvedAt,
                queueNumber: 0,
              }
            : request,
        ),
      );
    });

    socket.on('queue:updated', (event: QueueUpdatedEvent) => {
      if (event.tenantId !== session.user.tenantId) {
        return;
      }
      setRequests((current) => {
        const waitingMap = new Map(event.requests.map((item) => [item.id, item]));
        return current.map((request) => {
          const waiting = waitingMap.get(request.id);
          if (!waiting) {
            return request.status === 'waiting' ? { ...request, queueNumber: 0 } : request;
          }
          return { ...request, queueNumber: waiting.queueNumber };
        });
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [status, session?.user?.tenantId]);

  const normalizedKeyword = keyword.trim().toLowerCase();

  const filteredRequests = useMemo(() => {
    const byKeyword = requests.filter((request) => {
      if (!normalizedKeyword) {
        return true;
      }
      return (
        request.companyName.toLowerCase().includes(normalizedKeyword) ||
        request.requestedByEmail.toLowerCase().includes(normalizedKeyword) ||
        request.scriptTab.toLowerCase().includes(normalizedKeyword)
      );
    });

    return byKeyword.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }, [requests, normalizedKeyword]);

  const waitingRequests = useMemo(
    () =>
      filteredRequests
        .filter((request) => request.status === 'waiting')
        .sort((a, b) => a.queueNumber - b.queueNumber),
    [filteredRequests],
  );
  const joinedRequests = useMemo(
    () =>
      filteredRequests
        .filter((request) => request.status === 'joined')
        .sort((a, b) => (b.joinedAt ?? '').localeCompare(a.joinedAt ?? '')),
    [filteredRequests],
  );
  const closedRequestsAll = useMemo(
    () =>
      filteredRequests
        .filter((request) => request.status === 'closed')
        .sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? '')),
    [filteredRequests],
  );
  const closedRequests = useMemo(() => closedRequestsAll.slice(0, 50), [closedRequestsAll]);

  const handleJoin = async (requestId: string): Promise<void> => {
    if (!session?.accessToken) {
      setStatusMessage('アクセストークンが見つかりません。');
      return;
    }

    try {
      const updated = await joinHelpRequest(session.accessToken, requestId);
      setRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setStatusMessage(`参加開始: ${updated.companyName}`);
    } catch {
      setStatusMessage('参加処理に失敗しました。');
    }
  };

  const handleClose = async (requestId: string): Promise<void> => {
    if (!session?.accessToken) {
      setStatusMessage('アクセストークンが見つかりません。');
      return;
    }

    try {
      const updated = await closeHelpRequest(session.accessToken, requestId);
      setRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setStatusMessage(`対応完了: ${updated.companyName}`);
    } catch {
      setStatusMessage('対応完了処理に失敗しました。');
    }
  };

  const handleSendWhisper = async (requestId: string): Promise<void> => {
    const message = (whisperByRequestId[requestId] ?? '').trim();
    if (!message || !session?.accessToken) {
      setStatusMessage('メッセージを入力してください。');
      return;
    }
    setSendingWhisperId(requestId);
    try {
      await sendDirectorWhisper(session.accessToken, requestId, message);
      setWhisperByRequestId((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      setStatusMessage('囁きを送信しました。');
    } catch {
      setStatusMessage('囁きの送信に失敗しました。');
    } finally {
      setSendingWhisperId(null);
    }
  };

  if (status !== 'authenticated' || !session?.user) {
    return <main className="p-6">読み込み中...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <section className="mx-auto max-w-6xl space-y-4">
        <header className="flex items-center justify-between rounded border border-slate-200 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">ディレクターダッシュボード</h1>
            <p className="text-sm text-slate-600">
              担当: {session.user.name} / role: {session.user.role}
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

        <section className="rounded border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded px-3 py-1 text-xs ${filter === 'all' ? 'bg-slate-800 text-white' : 'border border-slate-300'}`}
                onClick={() => setFilter('all')}
              >
                すべて ({filteredRequests.length})
              </button>
              <button
                type="button"
                className={`rounded px-3 py-1 text-xs ${filter === 'waiting' ? 'bg-rose-600 text-white' : 'border border-slate-300'}`}
                onClick={() => setFilter('waiting')}
              >
                待機 ({waitingRequests.length})
              </button>
              <button
                type="button"
                className={`rounded px-3 py-1 text-xs ${filter === 'joined' ? 'bg-blue-600 text-white' : 'border border-slate-300'}`}
                onClick={() => setFilter('joined')}
              >
                対応中 ({joinedRequests.length})
              </button>
              <button
                type="button"
                className={`rounded px-3 py-1 text-xs ${filter === 'closed' ? 'bg-emerald-600 text-white' : 'border border-slate-300'}`}
                onClick={() => setFilter('closed')}
              >
                完了 ({closedRequests.length})
              </button>
            </div>
            <input
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm md:w-80"
              placeholder="会社名 / IS / スクリプトで検索"
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">待機キュー</h2>
            <div className="mt-3 space-y-2">
              {filter !== 'all' && filter !== 'waiting' ? (
                <p className="text-sm text-slate-400">フィルタにより非表示です。</p>
              ) : waitingRequests.length === 0 ? (
                <p className="text-sm text-slate-500">待機中の呼出はありません。</p>
              ) : (
                waitingRequests.map((request) => (
                    <div key={request.id} className="rounded border border-rose-200 bg-rose-50 p-3">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs ${getStatusBadge(request.status).className}`}>
                        {getStatusBadge(request.status).label}
                      </span>
                      <p className="mt-1 text-sm font-semibold text-rose-700">
                        キュー#{request.queueNumber} {request.companyName}
                      </p>
                      <p className="text-xs text-slate-600">IS: {request.requestedByEmail}</p>
                      <p className="text-xs text-slate-600">スクリプト: {request.scriptTab}</p>
                      <p className="text-xs text-slate-500">
                        呼出時刻: {new Date(request.requestedAt).toLocaleString('ja-JP')}
                      </p>
                      <button
                        type="button"
                        className="mt-2 rounded bg-blue-600 px-3 py-1 text-xs text-white"
                        onClick={() => {
                          void handleJoin(request.id);
                        }}
                      >
                        参加する
                      </button>
                    </div>
                  ))
              )}
            </div>
          </article>

          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">対応中</h2>
            <div className="mt-3 space-y-2">
              {filter !== 'all' && filter !== 'joined' ? (
                <p className="text-sm text-slate-400">フィルタにより非表示です。</p>
              ) : joinedRequests.length === 0 ? (
                <p className="text-sm text-slate-500">対応中の呼出はありません。</p>
              ) : (
                joinedRequests.map((request) => (
                  <div key={request.id} className="rounded border border-blue-200 bg-blue-50 p-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${getStatusBadge(request.status).className}`}>
                      {getStatusBadge(request.status).label}
                    </span>
                    <p className="mt-1 text-sm font-semibold text-blue-700">{request.companyName}</p>
                    <p className="text-xs text-slate-600">IS: {request.requestedByEmail}</p>
                    <p className="text-xs text-slate-600">スクリプト: {request.scriptTab}</p>
                    <p className="text-xs text-slate-500">
                      参加時刻: {request.joinedAt ? new Date(request.joinedAt).toLocaleString('ja-JP') : '-'}
                    </p>
                    <p className="text-xs text-slate-500">経過時間: {formatElapsed(request.joinedAt, nowMs)}</p>
                    <div className="mt-2 flex flex-col gap-1.5 border-t border-blue-200 pt-2">
                      <label className="text-xs font-medium text-slate-600">ISへ囁き送信</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={whisperByRequestId[request.id] ?? ''}
                          onChange={(e) =>
                            setWhisperByRequestId((prev) => ({ ...prev, [request.id]: e.target.value }))
                          }
                          placeholder="短いメッセージを入力..."
                          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          className="rounded bg-amber-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                          onClick={() => void handleSendWhisper(request.id)}
                          disabled={sendingWhisperId === request.id}
                        >
                          {sendingWhisperId === request.id ? '送信中...' : '送信'}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mt-2 rounded bg-slate-700 px-3 py-1 text-xs text-white"
                      onClick={() => {
                        void handleClose(request.id);
                      }}
                    >
                      対応完了
                    </button>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">対応完了</h2>
            {closedRequestsAll.length > 50 && (
              <p className="mt-1 text-xs text-slate-500">表示件数: 最新50件</p>
            )}
            <div className="mt-3 space-y-2">
              {filter !== 'all' && filter !== 'closed' ? (
                <p className="text-sm text-slate-400">フィルタにより非表示です。</p>
              ) : closedRequests.length === 0 ? (
                <p className="text-sm text-slate-500">完了した呼出はありません。</p>
              ) : (
                closedRequests.map((request) => (
                  <div key={request.id} className="rounded border border-emerald-200 bg-emerald-50 p-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${getStatusBadge(request.status).className}`}>
                      {getStatusBadge(request.status).label}
                    </span>
                    <p className="mt-1 text-sm font-semibold text-emerald-700">{request.companyName}</p>
                    <p className="text-xs text-slate-600">IS: {request.requestedByEmail}</p>
                    <p className="text-xs text-slate-600">スクリプト: {request.scriptTab}</p>
                    <p className="text-xs text-slate-500">
                      完了時刻: {request.resolvedAt ? new Date(request.resolvedAt).toLocaleString('ja-JP') : '-'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>

        <p className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          ステータス: {statusMessage}
        </p>
      </section>
    </main>
  );
};

export default DirectorPage;

