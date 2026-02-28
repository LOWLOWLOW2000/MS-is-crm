/**
 * 架電看板用仮データ（Phase2でAPIのみに切替えやすいよう一箇所に集約）
 * 本番・Phase2: NEXT_PUBLIC_CALLING_USE_MOCK_KANBAN を未設定 or 'false' にすればAPIのみになる
 */
import type { CallingList, CallingRecord, ListItem } from './types';

/** 開発時はモック有効。本番・Phase2: NEXT_PUBLIC_CALLING_USE_MOCK_KANBAN=false でAPIのみ */
export const USE_MOCK_KANBAN =
  process.env.NEXT_PUBLIC_CALLING_USE_MOCK_KANBAN !== 'false' &&
  (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_CALLING_USE_MOCK_KANBAN === 'true');

const now = (): number => Date.now();
const iso = (ms: number): string => new Date(ms).toISOString();

/** 動的モック再架電（毎回「1分前」「90秒後」等が再計算される） */
export const getMockRecallList = (): CallingRecord[] => {
  const t = now();
  const base: Omit<CallingRecord, 'nextCallAt'> = {
    id: 'mock-recall-1',
    tenantId: 'mock-tenant',
    createdBy: 'mock-user',
    companyName: '',
    companyPhone: '',
    companyAddress: '',
    targetUrl: '',
    approved: true,
    approvedAt: iso(t),
    approvedBy: 'mock',
    result: '折り返し依頼',
    memo: '',
    createdAt: iso(t),
    updatedAt: iso(t),
  };
  return [
    {
      ...base,
      id: 'mock-recall-overdue',
      companyName: '（モック）再架電期限過ぎ・ポップアップ用',
      nextCallAt: iso(t - 60 * 1000), // 1分前 → 未架電でポップアップ対象
    },
    {
      ...base,
      id: 'mock-recall-soon',
      companyName: '（モック）まもなく指定時刻・揺れ用',
      nextCallAt: iso(t + 90 * 1000), // 90秒後 → 2分以内で揺れ
    },
    {
      ...base,
      id: 'mock-recall-5m',
      companyName: '（モック）株式会社サンプルC',
      nextCallAt: iso(t + 5 * 60 * 1000),
    },
    {
      ...base,
      id: 'mock-recall-tomorrow',
      companyName: '（モック）翌日再架電テスト',
      nextCallAt: iso(t + 24 * 60 * 60 * 1000),
    },
  ];
};

/** 動的モック配布リスト */
export const getMockAssignedLists = (): CallingList[] => [
  {
    id: 'mock-list-1',
    tenantId: 'mock-tenant',
    name: '価格.com 系リード（モック）',
    sourceType: 'csv',
    createdBy: 'mock',
    createdAt: iso(now()),
    itemCount: 12,
    assigneeEmail: null,
    assignedBy: 'admin@example.com',
    assignedAt: iso(now()),
  },
  {
    id: 'mock-list-2',
    tenantId: 'mock-tenant',
    name: 'REINZ スタイル（モック）',
    sourceType: 'csv',
    createdBy: 'mock',
    createdAt: iso(now()),
    itemCount: 8,
    assigneeEmail: null,
    assignedBy: 'admin@example.com',
    assignedAt: iso(now()),
  },
  {
    id: 'mock-list-3',
    tenantId: 'mock-tenant',
    name: '今週のフォローアップ（モック）',
    sourceType: 'csv',
    createdBy: 'mock',
    createdAt: iso(now()),
    itemCount: 5,
    assigneeEmail: null,
    assignedBy: 'director@example.com',
    assignedAt: iso(now()),
  },
];

/** モックリスト用の明細（listId が mock- のときのみ使用） */
export const getMockListItems = (listId: string): ListItem[] => {
  const t = iso(now());
  const base = { tenantId: 'mock-tenant', listId, createdAt: t };
  if (listId === 'mock-list-1') {
    return [
      { ...base, id: 'mock-item-1-1', companyName: '株式会社サンプルA', phone: '03-1111-1111', address: '東京都', targetUrl: 'https://example.com/a', industryTag: null },
      { ...base, id: 'mock-item-1-2', companyName: '株式会社サンプルB', phone: '03-2222-2222', address: '大阪府', targetUrl: 'https://example.com/b', industryTag: null },
    ];
  }
  if (listId === 'mock-list-2' || listId === 'mock-list-3') {
    return [
      { ...base, id: `mock-item-${listId}-1`, companyName: '有限会社テストC', phone: '06-3333-4444', address: '福岡県', targetUrl: 'https://example.com/c', industryTag: null },
    ];
  }
  return [];
};
