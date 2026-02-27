'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchCallingSettings, updateCallingSettings } from '@/lib/calling-api';
import type { CallingSettings } from '@/lib/types';

const SettingsPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [settings, setSettings] = useState<CallingSettings | null>(null);
  const [nextValue, setNextValue] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
        const current = await fetchCallingSettings(session.accessToken);
        setSettings(current);
        setNextValue(current.humanApprovalEnabled);
        setStatusMessage('設定を読み込みました');
      } catch {
        setStatusMessage('設定の読み込みに失敗しました');
      }
    };

    void load();
  }, [status, session?.accessToken]);

  const canEdit = session?.user?.role === 'developer';

  const handleSave = async (): Promise<void> => {
    if (!session?.accessToken) {
      setStatusMessage('アクセストークンが見つかりません');
      return;
    }

    if (!canEdit) {
      setStatusMessage('developer 権限のみ変更可能です');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateCallingSettings(session.accessToken, {
        humanApprovalEnabled: nextValue,
      });
      setSettings(updated);
      setStatusMessage(
        `更新完了: 人間承認フロー ${updated.humanApprovalEnabled ? 'ON' : 'OFF'} (${new Date(
          updated.updatedAt,
        ).toLocaleString('ja-JP')})`,
      );
    } catch {
      setStatusMessage('設定更新に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (status !== 'authenticated' || !session?.user) {
    return <main className="p-6">読み込み中...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <section className="mx-auto max-w-4xl space-y-4">
        <header className="flex items-center justify-between rounded border border-slate-200 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">設定</h1>
            <p className="text-sm text-slate-600">承認スイッチ管理（developerのみ変更可）</p>
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
          <h2 className="text-base font-semibold">人間承認フロー</h2>
          <p className="mt-1 text-xs text-slate-500">
            ON: 目視確認と承認が必須 / OFF: 承認なしで発信可能（テスト用途）
          </p>

          <div className="mt-3 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="human-approval"
                checked={nextValue}
                onChange={() => setNextValue(true)}
                disabled={!canEdit}
              />
              ON
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="human-approval"
                checked={!nextValue}
                onChange={() => setNextValue(false)}
                disabled={!canEdit}
              />
              OFF
            </label>
          </div>

          <div className="mt-3 text-xs text-slate-600">
            現在値: {settings ? (settings.humanApprovalEnabled ? 'ON' : 'OFF') : '-'}
            {settings ? ` / 更新日時: ${new Date(settings.updatedAt).toLocaleString('ja-JP')}` : ''}
          </div>

          <button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={!canEdit || isSaving}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSaving ? '保存中...' : '設定を保存'}
          </button>

          {!canEdit && (
            <p className="mt-2 text-xs text-amber-700">
              現在のロールでは変更できません（developer のみ変更可）。
            </p>
          )}
        </section>

        <p className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          ステータス: {statusMessage}
        </p>
      </section>
    </main>
  );
};

export default SettingsPage;
