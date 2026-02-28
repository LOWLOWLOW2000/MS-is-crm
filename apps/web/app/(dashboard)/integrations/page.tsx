'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const INTEGRATIONS = [
  { id: 'slack', name: 'Slack', description: '日報提出時にチャンネルへポスト' },
  { id: 'teams', name: 'Microsoft Teams', description: '日報提出時にチャンネルへポスト' },
  { id: 'discord', name: 'Discord', description: '日報提出時にチャンネルへポスト' },
  { id: 'notion', name: 'Notion', description: '提出日報をデータベースへ同期' },
] as const;

export default function IntegrationsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    slack: false,
    teams: false,
    discord: false,
    notion: false,
  });
  const [connected, setConnected] = useState<Record<string, boolean>>({
    slack: false,
    teams: false,
    discord: false,
    notion: false,
  });

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated' || !session?.user) {
    return <div className="p-4">読み込み中...</div>;
  }

  const toggleEnabled = (id: string) => {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSetup = (id: string) => {
    alert('設定画面は未実装です。');
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">外部連携設定</h1>
      <p className="text-sm text-slate-600">
        日報提出時の通知先やNotion同期を設定します。各連携をONにし、未設定の場合は「設定する」から接続してください。
      </p>

      <div className="space-y-3">
        {INTEGRATIONS.map(({ id, name, description }) => (
          <div
            key={id}
            className="flex flex-wrap items-center justify-between gap-4 rounded border border-slate-200 bg-white p-4"
          >
            <div>
              <p className="font-medium text-slate-800">{name}</p>
              <p className="text-xs text-slate-500">{description}</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabled[id] ?? false}
                  onChange={() => toggleEnabled(id)}
                  className="rounded border-slate-300"
                />
                ON
              </label>
              <button
                type="button"
                onClick={() => handleSetup(id)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                {connected[id] ? '接続済' : '設定する'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
