'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ChangeEvent, useEffect, useState } from 'react';
import { assignCallingList, fetchCallingLists, fetchListItems, importCsvList } from '@/lib/calling-api';
import type { CallingList, ListItem } from '@/lib/types';

const csvTemplate = `companyName,phone,address,targetUrl,industry\n株式会社サンプル,03-1111-2222,東京都渋谷区1-1-1,https://example.com,製造`;
const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const ListsPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [listName, setListName] = useState('');
  const [csvText, setCsvText] = useState(csvTemplate);
  const [lists, setLists] = useState<CallingList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [assigneeEmail, setAssigneeEmail] = useState('');
  const [items, setItems] = useState<ListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('待機中');

  const loadLists = async (accessToken: string): Promise<void> => {
    const nextLists = await fetchCallingLists(accessToken);
    setLists(nextLists);

    if (nextLists.length === 0) {
      setSelectedListId('');
      setItems([]);
      return;
    }

    const nextSelectedId = selectedListId || nextLists[0].id;
    setSelectedListId(nextSelectedId);
    const nextItems = await fetchListItems(accessToken, nextSelectedId);
    setItems(nextItems);
  };

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
      setIsLoading(true);
      try {
        await loadLists(session.accessToken);
        setStatusMessage('リストを読み込みました');
      } catch {
        setStatusMessage('リストの読み込みに失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [status, session?.accessToken]);

  const handleImport = async (): Promise<void> => {
    if (!session?.accessToken) {
      setStatusMessage('アクセストークンが見つかりません');
      return;
    }

    if (!csvText.trim()) {
      setStatusMessage('CSVを入力してください');
      return;
    }

    setIsLoading(true);
    try {
      const result = await importCsvList(session.accessToken, {
        csvText,
        name: listName.trim() || undefined,
      });
      setStatusMessage(`取込完了: ${result.importedCount}件（スキップ ${result.skippedCount}件）`);
      setSelectedListId(result.list.id);
      await loadLists(session.accessToken);
    } catch {
      setStatusMessage('CSVインポートに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleListChange = async (event: ChangeEvent<HTMLSelectElement>): Promise<void> => {
    if (!session?.accessToken) {
      return;
    }

    const nextListId = event.target.value;
    setSelectedListId(nextListId);

    if (!nextListId) {
      setItems([]);
      return;
    }

    try {
      const nextItems = await fetchListItems(session.accessToken, nextListId);
      setItems(nextItems);
    } catch {
      setStatusMessage('リスト明細の取得に失敗しました');
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    setCsvText(text);
    setStatusMessage(`CSVを読み込みました: ${file.name}`);
  };

  const handleAssign = async (): Promise<void> => {
    if (!session?.accessToken || !selectedListId) {
      setStatusMessage('配布対象リストが選択されていません');
      return;
    }
    if (!assigneeEmail.trim()) {
      setStatusMessage('配布先メールアドレスを入力してください');
      return;
    }
    if (!isValidEmail(assigneeEmail.trim())) {
      setStatusMessage('配布先メールアドレスの形式が不正です');
      return;
    }

    setIsLoading(true);
    try {
      const assigned = await assignCallingList(session.accessToken, selectedListId, {
        assigneeEmail: assigneeEmail.trim(),
      });
      setStatusMessage(`配布完了: ${assigned.name} → ${assigned.assigneeEmail}`);
      await loadLists(session.accessToken);
    } catch {
      setStatusMessage('リスト配布に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (status !== 'authenticated' || !session?.user) {
    return <main className="p-6">読み込み中...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <section className="mx-auto max-w-7xl space-y-4">
        <header className="flex items-center justify-between rounded border border-slate-200 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">URLリスト管理（CSV）</h1>
            <p className="text-sm text-slate-600">tenantId: {session.user.tenantId}</p>
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

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">CSVインポート</h2>
            <p className="mt-1 text-xs text-slate-500">必須列: companyName, phone, address, targetUrl</p>
            <div className="mt-3 space-y-2">
              <input
                type="text"
                value={listName}
                onChange={(event) => setListName(event.target.value)}
                placeholder="リスト名（任意）"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input type="file" accept=".csv,text/csv" onChange={(event) => void handleFileUpload(event)} />
              <textarea
                value={csvText}
                onChange={(event) => setCsvText(event.target.value)}
                className="h-56 w-full rounded border border-slate-300 p-3 text-xs"
              />
              <button
                type="button"
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                onClick={() => {
                  void handleImport();
                }}
                disabled={isLoading}
              >
                {isLoading ? '処理中...' : 'CSVを取り込む'}
              </button>
            </div>
          </article>

          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">リスト一覧</h2>
            <div className="mt-3">
              <select
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={selectedListId}
                onChange={(event) => {
                  void handleListChange(event);
                }}
              >
                {lists.length === 0 ? (
                  <option value="">リストがありません</option>
                ) : (
                  lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}（{list.itemCount}件）
                    </option>
                  ))
                )}
              </select>
            </div>
            <p className="mt-2 text-xs text-slate-500">登録済み: {lists.length} リスト</p>
            <div className="mt-3 space-y-2 rounded border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-700">ISへ配布</p>
              <input
                type="email"
                value={assigneeEmail}
                onChange={(event) => setAssigneeEmail(event.target.value)}
                placeholder="member@example.com"
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  void handleAssign();
                }}
                disabled={!selectedListId || isLoading || !isValidEmail(assigneeEmail.trim())}
                className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-60"
              >
                {isLoading ? '配布中...' : 'このリストを配布'}
              </button>
              {selectedListId &&
                (() => {
                  const selectedList = lists.find((list) => list.id === selectedListId);
                  if (!selectedList?.assigneeEmail || !selectedList.assignedAt) {
                    return null;
                  }
                  return (
                    <p className="text-[11px] text-slate-600">
                      配布先: {selectedList.assigneeEmail} / 配布者: {selectedList.assignedBy ?? '-'} / 配布日時:{' '}
                      {new Date(selectedList.assignedAt).toLocaleString('ja-JP')}
                    </p>
                  );
                })()}
            </div>
            {selectedListId && (
              <Link
                href={`/calling/${selectedListId}`}
                className="mt-3 inline-block rounded bg-blue-600 px-3 py-2 text-xs text-white"
              >
                このリストで架電開始
              </Link>
            )}
          </article>
        </section>

        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold">リスト明細</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="px-2 py-2">会社名</th>
                  <th className="px-2 py-2">電話番号</th>
                  <th className="px-2 py-2">住所</th>
                  <th className="px-2 py-2">URL</th>
                  <th className="px-2 py-2">業種</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-slate-500">
                      明細がありません
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 text-xs">
                      <td className="px-2 py-2">{item.companyName}</td>
                      <td className="px-2 py-2">{item.phone}</td>
                      <td className="px-2 py-2">{item.address}</td>
                      <td className="px-2 py-2">
                        <a
                          href={item.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline"
                        >
                          {item.targetUrl}
                        </a>
                      </td>
                      <td className="px-2 py-2">{item.industryTag ?? '-'}</td>
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

export default ListsPage;
