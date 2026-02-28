'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchUsers, type UserListItem } from '@/lib/calling-api';
import { RoleBadge } from '../_components/role-badge';

const roleLabel: Record<string, string> = {
  developer: '開発者',
  enterprise_admin: '企業管理者',
  is_admin: 'IS管理者',
  director: 'ディレクター',
  is_member: 'ISメンバー',
};

const UsersPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [statusMessage, setStatusMessage] = useState('ユーザー一覧を読み込み中…');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }

    if (status === 'authenticated' && session?.user?.role === 'is_member') {
      router.replace('/dashboard');
      return;
    }
  }, [status, session?.user?.role, router]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const list = await fetchUsers(session.accessToken);
        setUsers(list);
        setStatusMessage(`${list.length}件のユーザーを読み込みました`);
      } catch {
        setStatusMessage('ユーザー一覧の取得に失敗しました（is_member はアクセスできません）');
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [status, session?.accessToken]);

  if (status !== 'authenticated' || !session?.user) {
    return (
      <main className="p-6">
        <p className="text-slate-600">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <section className="mx-auto max-w-5xl space-y-4">
        <header className="flex items-center justify-between rounded border border-slate-200 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">ユーザー一覧</h1>
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

        <div className="rounded border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <RoleBadge role={session.user.role} name={session.user.name ?? undefined} />
            <span className="text-xs text-slate-500">管理者のみ閲覧可能です</span>
          </div>

          {isLoading ? (
            <p className="py-8 text-center text-slate-500">読み込み中...</p>
          ) : (
            <div className="overflow-x-auto rounded border border-slate-200">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                    <th className="px-3 py-2">名前</th>
                    <th className="px-3 py-2">メール</th>
                    <th className="px-3 py-2">ロール</th>
                    <th className="px-3 py-2">登録日時</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                        ユーザーがありません
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-medium">{u.name}</td>
                        <td className="px-3 py-2">{u.email}</td>
                        <td className="px-3 py-2">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                            {roleLabel[u.role] ?? u.role}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {new Date(u.createdAt).toLocaleString('ja-JP')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-sm text-slate-600">ステータス: {statusMessage}</p>
        </div>
      </section>
    </main>
  );
};

export default UsersPage;
