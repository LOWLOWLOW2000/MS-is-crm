'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { fetchCallingSettings, updateCallingSettings } from '@/lib/calling-api';
import {
  getNeoPointerClips,
  getNeoPointerEnabled,
  getNeoPointerTemplates,
  NEO_POINTER_CONTENT_CHANGED,
  setNeoPointerClips,
  setNeoPointerEnabled,
  setNeoPointerTemplates,
} from '@/lib/neo-pointer-storage';
import type { NeoPointerClipItem } from '@/lib/neo-pointer-storage';
import type { CallingSettings } from '@/lib/types';

const NEO_POINTER_SETTING_EVENT = 'neo-pointer-setting-changed';

const SettingsPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [settings, setSettings] = useState<CallingSettings | null>(null);
  const [nextValue, setNextValue] = useState(true);
  const [neoPointerEnabled, setNeoPointerEnabledState] = useState(false);
  const [clips, setClipsState] = useState<NeoPointerClipItem[]>([]);
  const [templates, setTemplatesState] = useState<string[]>([]);
  const [editingClipIndex, setEditingClipIndex] = useState<number | null>(null);
  const [editingTemplateIndex, setEditingTemplateIndex] = useState<number | null>(null);
  const [draftClip, setDraftClip] = useState<NeoPointerClipItem>({ text: '', meta: '' });
  const [draftTemplate, setDraftTemplate] = useState('');
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

  useEffect(() => {
    setNeoPointerEnabledState(getNeoPointerEnabled());
  }, []);

  const loadNeoPointerContent = useCallback(() => {
    setClipsState(getNeoPointerClips());
    setTemplatesState(getNeoPointerTemplates());
  }, []);

  useEffect(() => {
    loadNeoPointerContent();
  }, [loadNeoPointerContent]);

  const handleNeoPointerChange = (enabled: boolean) => {
    setNeoPointerEnabled(enabled);
    setNeoPointerEnabledState(enabled);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NEO_POINTER_SETTING_EVENT, { detail: enabled }));
    }
    setStatusMessage(`NEOポインタ: ${enabled ? 'ON' : 'OFF'} に変更しました（即時反映）`);
  };

  const canEdit = session?.user?.role === 'developer';

  const dispatchContentChanged = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NEO_POINTER_CONTENT_CHANGED));
    }
  }, []);

  const saveClips = useCallback(
    (nextClips: NeoPointerClipItem[]) => {
      setNeoPointerClips(nextClips);
      setClipsState(nextClips);
      dispatchContentChanged();
      setStatusMessage('クリップ一覧を保存しました（即時反映）');
      setEditingClipIndex(null);
    },
    [dispatchContentChanged]
  );

  const saveTemplates = useCallback(
    (nextTemplates: string[]) => {
      setNeoPointerTemplates(nextTemplates);
      setTemplatesState(nextTemplates);
      dispatchContentChanged();
      setStatusMessage('定型文一覧を保存しました（即時反映）');
      setEditingTemplateIndex(null);
    },
    [dispatchContentChanged]
  );

  const handleSaveClip = useCallback(() => {
    const text = draftClip.text.trim();
    if (!text) return;
    if (editingClipIndex === null) return;
    if (editingClipIndex >= clips.length) {
      saveClips([...clips, { ...draftClip, text }]);
    } else {
      saveClips(
        clips.map((c, i) => (i === editingClipIndex ? { ...draftClip, text } : c))
      );
    }
  }, [clips, draftClip, editingClipIndex, saveClips]);

  const handleRemoveClip = useCallback(
    (index: number) => {
      saveClips(clips.filter((_, i) => i !== index));
    },
    [clips, saveClips]
  );

  const handleSaveTemplate = useCallback(() => {
    const text = draftTemplate.trim();
    if (editingTemplateIndex === null) return;
    if (!text) return;
    if (editingTemplateIndex >= templates.length) {
      saveTemplates([...templates, text]);
    } else {
      saveTemplates(
        templates.map((t, i) => (i === editingTemplateIndex ? text : t))
      );
    }
  }, [editingTemplateIndex, templates, draftTemplate, saveTemplates]);

  const handleRemoveTemplate = useCallback(
    (index: number) => {
      saveTemplates(templates.filter((_, i) => i !== index));
    },
    [templates, saveTemplates]
  );

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
            <p className="text-sm text-slate-600">
              承認スイッチ管理（developerのみ変更可）。ON時は架電画面で「内容確認・承認」後に発信可能になります。
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

        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold">NEOポインタ</h2>
          <p className="mt-1 text-xs text-slate-500">
            テキスト入力欄にクラス <code className="rounded bg-slate-100 px-1">neo-trigger</code> を付けると、フォーカス時にクリップボード・定型文などのショートカットウィジェットが表示されます。
          </p>
          <div className="mt-3 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="neo-pointer"
                checked={neoPointerEnabled}
                onChange={() => handleNeoPointerChange(true)}
              />
              ON
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="neo-pointer"
                checked={!neoPointerEnabled}
                onChange={() => handleNeoPointerChange(false)}
              />
              OFF
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            現在: {neoPointerEnabled ? 'ON' : 'OFF'}（ブラウザごとの設定・即時反映）
          </p>
        </section>

        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold">NEOポインタの内容</h2>
          <p className="mt-1 text-xs text-slate-500">
            クリップ一覧・定型文一覧を編集できます。保存するとウィジェットに即時反映されます（localStorage）。
          </p>

          <h3 className="mt-4 text-sm font-medium text-slate-700">クリップ一覧</h3>
          <p className="text-xs text-slate-500">テキストとメタ（任意のラベル）を設定します。</p>
          <ul className="mt-2 space-y-2">
            {clips.map((item, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50/50 p-2">
                {editingClipIndex === i ? (
                  <>
                    <input
                      type="text"
                      value={draftClip.text}
                      onChange={(e) => setDraftClip((d) => ({ ...d, text: e.target.value }))}
                      placeholder="テキスト"
                      className="min-w-[200px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="text"
                      value={draftClip.meta}
                      onChange={(e) => setDraftClip((d) => ({ ...d, meta: e.target.value }))}
                      placeholder="メタ"
                      className="w-24 rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleSaveClip}
                      className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingClipIndex(null)}
                      className="rounded border border-slate-400 px-2 py-1 text-xs"
                    >
                      キャンセル
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-slate-800">{item.text}</span>
                    {item.meta && (
                      <span className="text-xs text-slate-500">{item.meta}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingClipIndex(i);
                        setDraftClip({ text: item.text, meta: item.meta });
                      }}
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveClip(i)}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      削除
                    </button>
                  </>
                )}
              </li>
            ))}
            {editingClipIndex === clips.length && (
              <li className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50/50 p-2">
                <input
                  type="text"
                  value={draftClip.text}
                  onChange={(e) => setDraftClip((d) => ({ ...d, text: e.target.value }))}
                  placeholder="テキスト"
                  className="min-w-[200px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  type="text"
                  value={draftClip.meta}
                  onChange={(e) => setDraftClip((d) => ({ ...d, meta: e.target.value }))}
                  placeholder="メタ"
                  className="w-24 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSaveClip}
                  className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => setEditingClipIndex(null)}
                  className="rounded border border-slate-400 px-2 py-1 text-xs"
                >
                  キャンセル
                </button>
              </li>
            )}
          </ul>
          <button
            type="button"
            onClick={() => {
              setEditingClipIndex(clips.length);
              setDraftClip({ text: '', meta: '' });
            }}
            className="mt-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            クリップを追加
          </button>

          <h3 className="mt-6 text-sm font-medium text-slate-700">定型文一覧</h3>
          <p className="text-xs text-slate-500">1行1件のテキストです。</p>
          <ul className="mt-2 space-y-2">
            {templates.map((text, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50/50 p-2">
                {editingTemplateIndex === i ? (
                  <>
                    <input
                      type="text"
                      value={draftTemplate}
                      onChange={(e) => setDraftTemplate(e.target.value)}
                      placeholder="定型文"
                      className="min-w-[200px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTemplateIndex(null)}
                      className="rounded border border-slate-400 px-2 py-1 text-xs"
                    >
                      キャンセル
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-slate-800">{text}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTemplateIndex(i);
                        setDraftTemplate(text);
                      }}
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveTemplate(i)}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      削除
                    </button>
                  </>
                )}
              </li>
            ))}
            {editingTemplateIndex === templates.length && (
              <li className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50/50 p-2">
                <input
                  type="text"
                  value={draftTemplate}
                  onChange={(e) => setDraftTemplate(e.target.value)}
                  placeholder="定型文"
                  className="min-w-[200px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTemplateIndex(null)}
                  className="rounded border border-slate-400 px-2 py-1 text-xs"
                >
                  キャンセル
                </button>
              </li>
            )}
          </ul>
          <button
            type="button"
            onClick={() => {
              setEditingTemplateIndex(templates.length);
              setDraftTemplate('');
            }}
            className="mt-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            定型文を追加
          </button>
        </section>

        <p className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          ステータス: {statusMessage}
        </p>
      </section>
    </main>
  );
};

export default SettingsPage;
