'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';

/** 各セクションの大カテゴリ名を表示する（本番では false にして外す） */
const SHOW_SECTION_LABELS = true;

/** ダッシュボード用グリッドアイコン（小） */
const DashboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

/** モック：リスト1件（看板用） */
type MockList = { id: string; name: string; items: MockListItem[] };
type MockListItem = {
  id: string;
  companyName: string;
  phones: { department: string; number: string }[];
  /** リスト情報表示用（支店・部署・担当のありのみ） */
  branch?: string;
  section?: string;
  person?: string;
};

const MOCK_LISTS: MockList[] = [
  {
    id: 'list-1',
    name: '価格.com 系リード',
    items: [
      {
        id: 'item-1-1',
        companyName: '株式会社サンプルA',
        branch: '本社',
        section: '総務部',
        person: '担当者名',
        phones: [
          { department: '総務部', number: '03-1111-1111' },
          { department: '営業部', number: '03-1111-2222' },
        ],
      },
      {
        id: 'item-1-2',
        companyName: '株式会社サンプルB',
        branch: undefined,
        section: '代表',
        person: undefined,
        phones: [{ department: '代表', number: '03-2222-3333' }],
      },
    ],
  },
  {
    id: 'list-2',
    name: 'REINZ スタイルリスト',
    items: [
      {
        id: 'item-2-1',
        companyName: '有限会社テストC',
        branch: '本社',
        section: '営業部',
        person: '田中',
        phones: [
          { department: '本社', number: '06-3333-4444' },
          { department: '支社', number: '06-3333-5555' },
        ],
      },
    ],
  },
];

/** UI1 同様：メインタブ（企業HP・商品・案件・スクリプトA/B/C・自由書式） */
const MAIN_TAB_IDS = {
  companyHp: 'company-hp',
  product: 'product',
  mainA: 'main-a',
  mainB: 'main-b',
  mainC: 'main-c',
} as const;

const SUB_TABS_BY_MAIN: Record<string, { id: string; name: string }[]> = {
  [MAIN_TAB_IDS.mainA]: [
    { id: 'reception', name: '受付突破' },
    { id: 'intro', name: '導入トーク' },
  ],
  [MAIN_TAB_IDS.mainB]: [
    { id: 'objection', name: '反論対応' },
    { id: 'hearing', name: 'ヒアリング' },
  ],
  [MAIN_TAB_IDS.mainC]: [{ id: 'closing', name: 'クロージング' }],
  [MAIN_TAB_IDS.product]: [
    { id: 'client-info', name: 'クライアント情報' },
    { id: 'pj-info', name: 'PJインフォ' },
  ],
};

const MOCK_SCRIPT_CONTENT: Record<string, string> = {
  reception: 'お忙しいところ失礼いたします。株式会社〇〇の△△です。担当者様へ30秒だけご相談事項がありお電話しました。',
  intro: '本日は御社の業務効率化に関する情報提供です。現在の運用を3点だけお伺いし、合う場合のみご案内いたします。',
  objection: 'ご懸念はもっともです。多くのお客様から同様のお声をいただき、〇〇のようにご対応いただいております。',
  hearing: '御社では現在、どのような課題を感じていらっしゃいますか。予算感やご検討時期についてもお聞かせください。',
  closing: 'それでは〇月〇日〇時で確定とさせていただきます。ご確認の資料をメールでお送りします。',
};

/** モック：案件メンバー（社員証カード用） */
const MOCK_MEMBERS = [
  { id: 'm1', name: '山田 太郎', role: 'ISリード', department: '営業部', number: '001' },
  { id: 'm2', name: '佐藤 花子', role: 'ISメンバー', department: '営業部', number: '002' },
  { id: 'm3', name: '鈴木 一郎', role: 'ディレクター', department: '営業部', number: '003' },
];

/** アポ・資料請求ログ用：ポジティブな情報のみ（約3秒で切替。企業ID/ディレクターIDから登録予定） */
const MOCK_APPO_LOG_MESSAGES = [
  '今月アポ達成率120%突破！',
  '資料送付 今週+5件 達成',
  'KEY接続 チーム目標を達成しました',
  '新規アポ 3件 本日獲得',
];

/** モック：KPI（範囲×期間で切替） */
const MOCK_KPI: Record<'個人' | 'チーム' | '全体', Record<'当日' | '週' | '月', { 架電数: number; アポ: number; KEY接続: number; 資料送付: number }>> = {
  個人: {
    当日: { 架電数: 0, アポ: 3, KEY接続: 8, 資料送付: 2 },
    週: { 架電数: 12, アポ: 4, KEY接続: 9, 資料送付: 3 },
    月: { 架電数: 45, アポ: 15, KEY接続: 32, 資料送付: 10 },
  },
  チーム: {
    当日: { 架電数: 5, アポ: 2, KEY接続: 6, 資料送付: 1 },
    週: { 架電数: 28, アポ: 10, KEY接続: 22, 資料送付: 7 },
    月: { 架電数: 120, アポ: 42, KEY接続: 95, 資料送付: 28 },
  },
  全体: {
    当日: { 架電数: 12, アポ: 5, KEY接続: 14, 資料送付: 4 },
    週: { 架電数: 68, アポ: 24, KEY接続: 55, 資料送付: 18 },
    月: { 架電数: 280, アポ: 98, KEY接続: 220, 資料送付: 65 },
  },
};

const KPI_GOALS = { 架電数: 15, アポ: 5, KEY接続: 10, 資料送付: 3 };
const KPI_KEYS = ['架電数', 'アポ', 'KEY接続', '資料送付'] as const;

const CallingPageV2 = () => {
  const [scopeTab, setScopeTab] = useState<'個人' | 'チーム' | '全体'>('個人');
  const [periodTab, setPeriodTab] = useState<'当日' | '週' | '月'>('当日');
  const [caseName, setCaseName] = useState('架電PJ 2025-Q1');
  const [showMemberCards, setShowMemberCards] = useState(false);
  const [appoLogIndex, setAppoLogIndex] = useState(0);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [mainDisplayItem, setMainDisplayItem] = useState<MockListItem | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<{ department: string; number: string } | null>(null);
  const [listConfirmed, setListConfirmed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [callState, setCallState] = useState<'idle' | 'outbound' | 'inbound'>('idle');
  /** UI1 同様：右カラム MAIN 上部タブ */
  const [activeMainTabId, setActiveMainTabId] = useState<string>(MAIN_TAB_IDS.companyHp);
  const [activeSubTabId, setActiveSubTabId] = useState<string>('reception');

  const handleListDisplay = (item: MockListItem): void => {
    setMainDisplayItem(item);
    setSelectedPhone(item.phones[0] ?? null);
    setExpandedListId(null);
  };

  const handleConfirmList = (): void => {
    setListConfirmed(true);
  };

  const handleBackToList = (): void => {
    setListConfirmed(false);
    setCallState('idle');
  };

  useEffect(() => {
    if (!showMemberCards) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMemberCards(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [showMemberCards]);

  useEffect(() => {
    const t = setInterval(() => {
      setAppoLogIndex((i) => (i + 1) % MOCK_APPO_LOG_MESSAGES.length);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const kpi = MOCK_KPI[scopeTab][periodTab];

  /** メインタブ一覧（UI1 同様） */
  const mainTabs = [
    { id: MAIN_TAB_IDS.companyHp, name: '企業HP' },
    { id: MAIN_TAB_IDS.mainA, name: 'A（オープニング）' },
    { id: MAIN_TAB_IDS.mainB, name: 'B（本論）' },
    { id: MAIN_TAB_IDS.mainC, name: 'C（締め）' },
    { id: MAIN_TAB_IDS.product, name: '商品・案件' },
  ];
  const subTabs = SUB_TABS_BY_MAIN[activeMainTabId] ?? [];
  const effectiveSubTabId =
    subTabs.length > 0 && subTabs.some((s) => s.id === activeSubTabId)
      ? activeSubTabId
      : subTabs[0]?.id ?? '';
  const isCompanyHpTab = activeMainTabId === MAIN_TAB_IDS.companyHp;
  const isProductTab = activeMainTabId === MAIN_TAB_IDS.product;
  const isClientInfoSubTab = effectiveSubTabId === 'client-info';
  const isPjInfoSubTab = effectiveSubTabId === 'pj-info';
  const scriptContent =
    effectiveSubTabId && MOCK_SCRIPT_CONTENT[effectiveSubTabId]
      ? MOCK_SCRIPT_CONTENT[effectiveSubTabId]
      : '';

  /** リスト情報表示用：前リスト・次リスト名（モック） */
  const currentList = mainDisplayItem ? MOCK_LISTS.find((l) => l.items.some((i) => i.id === mainDisplayItem.id)) : null;
  const currentItemIndex = currentList ? currentList.items.findIndex((i) => i.id === mainDisplayItem!.id) : -1;
  const prevListName =
    currentList && currentItemIndex > 0 ? currentList.name : currentList && currentItemIndex === 0 ? MOCK_LISTS[MOCK_LISTS.indexOf(currentList) - 1]?.name ?? null : null;
  const nextListName =
    currentList && currentItemIndex >= 0 && currentItemIndex < currentList.items.length - 1
      ? currentList.name
      : currentList && currentItemIndex === currentList.items.length - 1
        ? MOCK_LISTS[MOCK_LISTS.indexOf(currentList) + 1]?.name ?? null
        : null;

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col bg-slate-100">
      {/* ヘッダー：2行レイアウト */}
      <header className="relative shrink-0 flex flex-col border-b border-slate-200 bg-white px-3 py-2">
        {SHOW_SECTION_LABELS && (
          <span className="absolute left-2 top-2 z-10 text-xs font-medium text-black">ヘッダー</span>
        )}
        {/* 1行目：架電PJ・ISメンバー・案内文・範囲・期間・案件名・案件メンバー・ダッシュボード・ログアウト */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">{caseName || '架電PJ 2025-Q1'}</span>
          <span className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            ISメンバー
          </span>
          <span className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            IS Member User
          </span>
          <span className="text-xs text-slate-500">
            今日の架電状況と次に架電する企業を確認しましょう。
          </span>
          <span className="border-l border-slate-200 pl-2 text-xs font-medium text-slate-500">範囲</span>
          {(['個人', 'チーム', '全体'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScopeTab(s)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                scopeTab === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s}
            </button>
          ))}
          <span className="text-xs font-medium text-slate-500">期間</span>
          {(['当日', '週', '月'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodTab(p)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                periodTab === p ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p}
            </button>
          ))}
          <span className="border-l border-slate-200 pl-2 text-xs font-medium text-slate-500">案件名</span>
          <input
            type="text"
            value={caseName}
            onChange={(e) => setCaseName(e.target.value)}
            className="max-w-[200px] rounded border border-slate-200 px-2 py-1 text-xs"
            placeholder="架電PJ 2025-Q1"
          />
          <button
            type="button"
            onClick={() => setShowMemberCards(true)}
            className="flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            title="案件メンバーを表示"
          >
            <span className="text-base">👥</span>
            案件メンバー
          </button>
          <Link
            href="/dashboard"
            className="ml-auto flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
            title="ダッシュボード"
          >
            <DashboardIcon />
            ダッシュボード
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            ログアウト
          </button>
        </div>

        {/* 2行目：KPI 4種 ＋ アポ・資料請求ログ */}
        <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2">
          {KPI_KEYS.map((key) => {
            const current = kpi[key];
            const goal = KPI_GOALS[key];
            const rate = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
            return (
              <div
                key={key}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs"
              >
                <span className="font-medium text-slate-700">{key}</span>
                <span className="ml-1 font-semibold text-slate-800">{current}</span>
                <span className="ml-1 text-slate-500">目標 {goal}</span>
                <span className="ml-1 text-slate-600">達成{rate}%</span>
              </div>
            );
          })}
          <div className="ml-auto flex min-w-0 flex-1 flex-col md:max-w-sm">
            <p className="text-[10px] text-slate-400">
              アポ・資料請求ログ（ポジティブな情報のみ・約3秒で切替・企業ID/ディレクターIDから登録予定）
            </p>
            <p className="mt-0.5 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800" key={appoLogIndex}>
              {MOCK_APPO_LOG_MESSAGES[appoLogIndex]}
            </p>
          </div>
        </div>
      </header>

      {/* 案件メンバーカード（社員証風）オーバーレイ */}
      {showMemberCards && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowMemberCards(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowMemberCards(false)}
          role="button"
          tabIndex={0}
          aria-label="閉じる"
        >
          <div
            className="flex max-h-[85vh] max-w-2xl flex-wrap justify-center gap-4 overflow-auto rounded-lg border border-slate-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="案件メンバー"
          >
            <div className="flex w-full items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-semibold text-slate-700">案件メンバー</h3>
              <button
                type="button"
                onClick={() => setShowMemberCards(false)}
                className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                閉じる
              </button>
            </div>
            {MOCK_MEMBERS.map((member) => (
              <div
                key={member.id}
                className="flex w-[140px] flex-col rounded-lg border-2 border-slate-200 bg-slate-50 p-3 shadow-sm"
              >
                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-slate-300 text-2xl text-slate-500">
                  {member.name.charAt(0)}
                </div>
                <p className="text-center text-sm font-bold text-slate-800">{member.name}</p>
                <p className="text-center text-xs text-slate-600">{member.role}</p>
                <p className="text-center text-xs text-slate-500">{member.department}</p>
                <p className="mt-1 text-center text-xs text-slate-400">No.{member.number}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-4 overflow-auto p-4">
        {/* 左カラム：リスト一覧 + 詳細 + フロー */}
        <aside className="flex w-full max-w-md shrink-0 flex-col gap-3 overflow-auto">
          <>
            {SHOW_SECTION_LABELS && (
              <span className="text-xs font-medium text-black">左カラム 上</span>
            )}
            {/* リスト一覧（看板パネル） */}
              <section className="rounded border border-slate-200 bg-white p-3 shadow-sm">
                <h2 className="mb-2 text-sm font-semibold text-slate-700">リスト一覧</h2>
                <div className="space-y-2">
                  {MOCK_LISTS.map((list) => (
                    <div key={list.id} className="rounded border border-slate-200 bg-slate-50">
                      <button
                        type="button"
                        onClick={() => setExpandedListId(expandedListId === list.id ? null : list.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-100"
                      >
                        <span className="text-lg">📋</span>
                        <span>{list.name}</span>
                        <span className="ml-auto text-slate-400">{expandedListId === list.id ? '▼' : '▶'}</span>
                      </button>
                      {expandedListId === list.id && (
                        <div className="border-t border-slate-200 bg-white p-2">
                          <div className="space-y-2 text-sm">
                            {list.items.map((item) => (
                              <div key={item.id} className="grid grid-cols-[auto_1fr] gap-2 rounded border border-slate-100 p-2">
                                <div className="flex flex-col gap-1">
                                  <button
                                    type="button"
                                    className="rounded border border-amber-500 bg-amber-50 px-2 py-1 text-xs text-amber-800"
                                    onClick={() => {}}
                                  >
                                    修正
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded border border-blue-500 bg-blue-50 px-2 py-1 text-xs text-blue-800"
                                    onClick={() => handleListDisplay(item)}
                                  >
                                    リスト表示
                                  </button>
                                </div>
                                <div
                                  className={`rounded border p-2 ${
                                    mainDisplayItem?.id === item.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                                  }`}
                                >
                                  <p className="font-medium">{item.companyName}</p>
                                  <p className="text-xs text-slate-500">
                                    {item.phones.map((p) => p.number).join(' / ')}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* リスト詳細パネル（会社名 + 電話一覧） */}
              {mainDisplayItem && (
                <section className="rounded border border-slate-200 bg-white p-3 shadow-sm">
                  <h2 className="mb-2 text-sm font-semibold text-slate-700">リスト詳細</h2>
                  <p className="mb-2 font-medium text-slate-800">{mainDisplayItem.companyName}</p>
                  <div className="flex flex-wrap gap-2">
                    {mainDisplayItem.phones.map((ph, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedPhone(ph)}
                        className={`rounded border p-2 text-left text-sm transition-all ${
                          selectedPhone?.number === ph.number
                            ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-400'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <p className="text-xs text-slate-500">{ph.department}</p>
                        <p className="font-medium">{ph.number}</p>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {SHOW_SECTION_LABELS && (
                <span className="block text-xs font-medium text-black">左カラム 下</span>
              )}
              {/* リスト内容確認フロー（同一DIV内） */}
              <section className="rounded border-2 border-slate-200 bg-white p-4 shadow-sm">
                {!listConfirmed ? (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-slate-600">リスト内容を確認したらボタンを押してください</p>
                    <button
                      type="button"
                      onClick={handleConfirmList}
                      className="rounded-xl bg-emerald-600 px-6 py-3 text-lg font-bold text-white shadow-lg transition-all hover:bg-emerald-700 hover:shadow-xl active:scale-95"
                    >
                      リスト☑完了
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-emerald-700">✓ リスト内容承認済み</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCallState(callState === 'outbound' ? 'idle' : 'outbound')}
                        className={`rounded-lg px-4 py-3 text-sm font-bold transition-all ${
                          callState === 'outbound' ? 'bg-green-600 text-white ring-2 ring-green-400' : 'bg-slate-700 text-white hover:bg-slate-600'
                        }`}
                      >
                        発信
                      </button>
                      <button
                        type="button"
                        onClick={() => setCallState(callState === 'inbound' ? 'idle' : 'inbound')}
                        className={`rounded-lg px-4 py-3 text-sm font-bold transition-all ${
                          callState === 'inbound' ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-600 text-white hover:bg-slate-500'
                        }`}
                      >
                        着信
                      </button>
                      <button
                        type="button"
                        onClick={() => setMuted(!muted)}
                        className={`rounded-lg px-3 py-3 text-sm font-medium ${
                          muted ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {muted ? 'ミュートON' : 'ミュート'}
                      </button>
                    </div>
                    {selectedPhone && (
                      <p className="text-xs text-slate-500">発信先: {selectedPhone.department} {selectedPhone.number}</p>
                    )}
                  </div>
                )}

                {/* リスト情報（リスト視認フローの段階から表示。電話機能の直下） */}
                <section className="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
                  <h3 className="mb-2 text-xs font-semibold text-slate-600">リスト情報</h3>
                  {mainDisplayItem ? (
                    <div className="space-y-2 text-xs text-slate-700">
                      {prevListName && (
                        <p>
                          <span className="text-slate-500">前リスト:</span> {prevListName}
                        </p>
                      )}
                      <div className="rounded border border-slate-200 bg-white p-2">
                        <p className="font-medium">{mainDisplayItem.companyName}</p>
                        {mainDisplayItem.branch && <p><span className="text-slate-500">支店:</span> {mainDisplayItem.branch}</p>}
                        {mainDisplayItem.section && <p><span className="text-slate-500">部署:</span> {mainDisplayItem.section}</p>}
                        <p><span className="text-slate-500">担当:</span> {mainDisplayItem.person ?? '—'}</p>
                        {selectedPhone && (
                          <p><span className="text-slate-500">電話:</span> {selectedPhone.department} {selectedPhone.number}</p>
                        )}
                      </div>
                      {nextListName && (
                        <p>
                          <span className="text-slate-500">次リスト:</span> {nextListName}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-500">リストから「リスト表示」を押すと表示されます</p>
                  )}
                </section>

                <footer className="mt-4 border-t border-slate-200 pt-3">
                  <button
                    type="button"
                    onClick={handleBackToList}
                    className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    ← リストに戻る
                  </button>
                </footer>
              </section>
            </>
        </aside>

        {/* 右側：メイン表示エリア（UI1 同様タブ + コンテンツ） */}
        <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded border border-slate-200 bg-white">
          {SHOW_SECTION_LABELS && (
            <span className="absolute left-2 top-2 z-10 text-xs font-medium text-black">右メイン</span>
          )}
          {/* メインタブ（UI1 の MAIN 上部タブを再現） */}
          <div className="shrink-0 border-b border-slate-200 p-2">
            <div className="flex flex-wrap items-center gap-2">
              {mainTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`rounded px-2 py-1 text-xs ${
                    activeMainTabId === tab.id ? 'bg-blue-600 text-white' : 'border border-slate-300 text-slate-700'
                  }`}
                  onClick={() => {
                    setActiveMainTabId(tab.id);
                    const subs = SUB_TABS_BY_MAIN[tab.id];
                    if (subs?.length) setActiveSubTabId(subs[0].id);
                  }}
                >
                  {tab.name}
                </button>
              ))}
            </div>
            {subTabs.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 p-2">
                {subTabs.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    className={`rounded px-2 py-1 text-xs ${
                      effectiveSubTabId === sub.id ? 'bg-slate-600 text-white' : 'border border-slate-300 text-slate-700'
                    }`}
                    onClick={() => setActiveSubTabId(sub.id)}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* タブごとのコンテンツ */}
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {isCompanyHpTab ? (
              <p className="text-sm text-slate-500">企業HPは上で表示しています。</p>
            ) : isProductTab && isClientInfoSubTab && mainDisplayItem ? (
              <div className="space-y-2 text-sm text-slate-700">
                <h3 className="font-semibold text-slate-800">クライアント情報</h3>
                <p><span className="text-slate-500">会社名:</span> {mainDisplayItem.companyName}</p>
                {selectedPhone && (
                  <p><span className="text-slate-500">電話:</span> {selectedPhone.department} {selectedPhone.number}</p>
                )}
                {mainDisplayItem.branch && <p><span className="text-slate-500">支店:</span> {mainDisplayItem.branch}</p>}
                {mainDisplayItem.section && <p><span className="text-slate-500">部署:</span> {mainDisplayItem.section}</p>}
              </div>
            ) : isProductTab && isPjInfoSubTab ? (
              <p className="text-sm text-slate-600">PJインフォ（ディレクターが登録した項目がここに表示されます）</p>
            ) : scriptContent ? (
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{scriptContent}</p>
            ) : (
              <p className="text-sm text-slate-500">コンテンツを選択してください。</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CallingPageV2;
