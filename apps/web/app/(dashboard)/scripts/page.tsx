'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  createScriptTemplate,
  deleteScriptTemplate,
  fetchScriptTemplates,
  updateScriptTemplate,
} from '@/lib/calling-api';
import type { ScriptTab, ScriptTemplate } from '@/lib/types';

const DEFAULT_TABS: ScriptTab[] = [
  { id: 'reception', name: '受付突破', content: '受付突破トーク', isCustom: false },
  { id: 'intro', name: '導入トーク', content: '導入トーク本文', isCustom: false },
  { id: 'objection', name: '反論対応', content: '反論対応本文', isCustom: false },
  { id: 'hearing', name: 'ヒアリング', content: 'ヒアリング本文', isCustom: false },
  { id: 'closing', name: 'クロージング', content: 'クロージング本文', isCustom: false },
  { id: 'product', name: '商品説明', content: '商品説明本文', isCustom: false },
];

const ScriptsPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [templates, setTemplates] = useState<ScriptTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [name, setName] = useState('');
  const [industryTag, setIndustryTag] = useState('');
  const [tabs, setTabs] = useState<ScriptTab[]>(DEFAULT_TABS);
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

  const loadTemplates = async (accessToken: string): Promise<void> => {
    const next = await fetchScriptTemplates(accessToken);
    setTemplates(next);

    if (next.length === 0) {
      setSelectedId('');
      return;
    }

    const selected = next.find((template) => template.id === selectedId) ?? next[0];
    setSelectedId(selected.id);
    setName(selected.name);
    setIndustryTag(selected.industryTag ?? '');
    setTabs(selected.tabs);
  };

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) {
      return;
    }

    const load = async (): Promise<void> => {
      try {
        await loadTemplates(session.accessToken);
        setStatusMessage('スクリプト一覧を読み込みました');
      } catch {
        setStatusMessage('スクリプト一覧の取得に失敗しました');
      }
    };

    void load();
  }, [status, session?.accessToken]);

  const selectedTemplate = useMemo(() => {
    return templates.find((template) => template.id === selectedId) ?? null;
  }, [templates, selectedId]);

  const handleSelectTemplate = (templateId: string): void => {
    const template = templates.find((candidate) => candidate.id === templateId);
    if (!template) {
      return;
    }

    setSelectedId(template.id);
    setName(template.name);
    setIndustryTag(template.industryTag ?? '');
    setTabs(template.tabs);
  };

  const handleAddCustomTab = (): void => {
    if (tabs.length >= 10) {
      setStatusMessage('タブは最大10枚までです');
      return;
    }

    const nextIndex = tabs.length + 1;
    setTabs((current) => [
      ...current,
      {
        id: `custom-${nextIndex}`,
        name: `自由書式${nextIndex}`,
        content: '',
        isCustom: true,
      },
    ]);
  };

  const updateTab = (tabId: string, field: 'name' | 'content', value: string): void => {
    setTabs((current) =>
      current.map((tab) => (tab.id === tabId ? { ...tab, [field]: value } : tab)),
    );
  };

  const handleCreate = async (): Promise<void> => {
    if (!session?.accessToken) {
      setStatusMessage('アクセストークンが見つかりません');
      return;
    }

    try {
      const created = await createScriptTemplate(session.accessToken, {
        name,
        industryTag: industryTag || undefined,
        tabs,
      });
      await loadTemplates(session.accessToken);
      setSelectedId(created.id);
      setStatusMessage('スクリプトを作成しました');
    } catch {
      setStatusMessage('スクリプト作成に失敗しました');
    }
  };

  const handleUpdate = async (): Promise<void> => {
    if (!session?.accessToken || !selectedTemplate) {
      setStatusMessage('更新対象がありません');
      return;
    }

    try {
      await updateScriptTemplate(session.accessToken, selectedTemplate.id, {
        name,
        industryTag: industryTag || undefined,
        tabs,
      });
      await loadTemplates(session.accessToken);
      setStatusMessage('スクリプトを更新しました');
    } catch {
      setStatusMessage('スクリプト更新に失敗しました');
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!session?.accessToken || !selectedTemplate) {
      setStatusMessage('削除対象がありません');
      return;
    }

    try {
      await deleteScriptTemplate(session.accessToken, selectedTemplate.id);
      await loadTemplates(session.accessToken);
      setStatusMessage('スクリプトを削除しました');
    } catch {
      setStatusMessage('スクリプト削除に失敗しました');
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
            <h1 className="text-2xl font-bold">トークスクリプト管理</h1>
            <p className="text-sm text-slate-600">固定タブ+自由書式（最大10タブ）</p>
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
            <h2 className="text-base font-semibold">テンプレート一覧（{templates.length}件）</h2>
            <div className="mt-3 space-y-2">
              {templates.length === 0 ? (
                <p className="text-sm text-slate-500">登録されたテンプレートはありません</p>
              ) : (
                templates.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    onClick={() => handleSelectTemplate(template.id)}
                    className={`w-full rounded border px-3 py-2 text-left text-sm ${
                      template.id === selectedId
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className="font-medium">{template.name}</p>
                    <p className="text-xs text-slate-500">
                      業種: {template.industryTag ?? '-'} / 更新: {new Date(template.updatedAt).toLocaleString('ja-JP')}
                    </p>
                  </button>
                ))
              )}
            </div>
          </article>

          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">編集</h2>
            <div className="mt-3 space-y-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="テンプレート名"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={industryTag}
                onChange={(event) => setIndustryTag(event.target.value)}
                placeholder="業種タグ（任意）"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleCreate();
                  }}
                  className="rounded bg-emerald-600 px-3 py-2 text-xs text-white"
                >
                  新規作成
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleUpdate();
                  }}
                  className="rounded bg-blue-600 px-3 py-2 text-xs text-white"
                >
                  上書き保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleDelete();
                  }}
                  className="rounded bg-rose-600 px-3 py-2 text-xs text-white"
                >
                  削除
                </button>
              </div>
            </div>
          </article>
        </section>

        <section className="rounded border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-base font-semibold text-slate-600">PDF取り込み</h2>
          <p className="mt-1 text-sm text-slate-500">Phase2で実装予定。管理者がPDFをアップロードするとテキストを抽出してタブに反映します。</p>
        </section>

        <section className="rounded border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">タブ編集</h2>
            <button
              type="button"
              onClick={handleAddCustomTab}
              className="rounded border border-slate-300 px-3 py-1 text-xs"
            >
              + 自由書式タブ追加
            </button>
          </div>
          <div className="space-y-3">
            {tabs.map((tab) => (
              <div key={tab.id} className="rounded border border-slate-200 p-3">
                <input
                  value={tab.name}
                  onChange={(event) => updateTab(tab.id, 'name', event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea
                  value={tab.content}
                  onChange={(event) => updateTab(tab.id, 'content', event.target.value)}
                  className="mt-2 h-24 w-full rounded border border-slate-300 p-2 text-sm"
                />
              </div>
            ))}
          </div>
        </section>

        <p className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          ステータス: {statusMessage}
        </p>
      </section>
    </main>
  );
};

export default ScriptsPage;
