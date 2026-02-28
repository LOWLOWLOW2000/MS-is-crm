'use client';

import Link from 'next/link';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import {
  createZoomDialSession,
  createCallingApproval,
  createHelpRequest,
  fetchAssignedCallingLists,
  fetchListItems,
  fetchCallingSettings,
  fetchRecallList,
  getApiBaseUrl,
  saveCallingRecord,
  validateDialPermission,
} from '@/lib/calling-api';
import type {
  CallingList,
  CallingRecord,
  CallingResultType,
  ListAssignedEvent,
  ListItem,
  ListUnassignedEvent,
  RecallReminderEvent,
} from '@/lib/types';
import { useCallingSessionStore } from '@/lib/stores/calling-session-store';
import {
  USE_MOCK_KANBAN,
  getMockAssignedLists,
  getMockListItems,
  getMockRecallList,
} from '@/lib/mock-calling-kanban';
import CallingPageV2 from './CallingPageV2';

type ScriptTab = {
  id: string;
  name: string;
  content: string;
  isCustom: boolean;
};

/** 各セクションの大カテゴリ名を表示する（本番では false にして外す） */
const SHOW_SECTION_LABELS = true;

const BGM_VOLUME_KEY = 'calling-bgm-volume';
const COMPANY_HP_TAB_ID = 'company-hp';
const MAIN_TAB_A = 'main-a';
const MAIN_TAB_B = 'main-b';
const MAIN_TAB_C = 'main-c';
const PRODUCT_TAB_ID = 'product';
const BASE_COMPANY_URL = 'https://example.com';

/** メインタブA/B/Cの下に出すサブタブ（仕様v2） */
const SUB_TABS_BY_MAIN: Record<string, { id: string; name: string }[]> = {
  [MAIN_TAB_A]: [
    { id: 'reception', name: '受付突破' },
    { id: 'intro', name: '本人フロント' },
  ],
  [MAIN_TAB_B]: [
    { id: 'objection', name: '反論返し' },
    { id: 'hearing', name: 'ヒアリング' },
  ],
  [MAIN_TAB_C]: [{ id: 'closing', name: 'クロージング' }],
  [PRODUCT_TAB_ID]: [
    { id: 'client-info', name: 'クライアント情報' },
    { id: 'pj-info', name: 'PJインフォ' },
  ],
};

/** クロージングのアポ条件（アポと紐付けて条件回収率として記録） */
const CLOSING_APPO_CONDITIONS = [
  { id: 'datetime', label: '日時確定' },
  { id: 'contact', label: '担当者確定' },
  { id: 'content', label: '内容合意' },
] as const;
const RESULT_OPTIONS: CallingResultType[] = [
  '担当者あり興味',
  '担当者あり不要',
  '不在',
  '番号違い',
  '断り',
  '折り返し依頼',
  '留守電',
];

/** 結果種別ごとの次回架電デフォルト（datetime-local 用文字列） */
const getDefaultNextCallAt = (result: CallingResultType): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toLocal = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  switch (result) {
    case '不在':
      now.setDate(now.getDate() + 1);
      return toLocal(now);
    case '折り返し依頼':
      now.setHours(now.getHours() + 2);
      return toLocal(now);
    case '留守電':
      now.setDate(now.getDate() + 3);
      return toLocal(now);
    case '担当者あり興味':
      now.setDate(now.getDate() + 7);
      return toLocal(now);
    default:
      return '';
  }
};

/** 結果種別ごとのメモひな型（空のときのみ適用） */
const MEMO_TEMPLATES: Record<CallingResultType, string> = {
  担当者あり興味: '担当者名: \n検討時期: \n',
  担当者あり不要: '理由: \n',
  不在: '次回連絡希望: \n',
  番号違い: '正しい番号: \n',
  断り: '理由: \n',
  折り返し依頼: '折り返し予定: \n',
  留守電: '伝言内容: \n',
};

const fixedTabs: ScriptTab[] = [
  {
    id: 'reception',
    name: '受付突破',
    isCustom: false,
    content:
      'お忙しいところ失礼いたします。株式会社〇〇の△△です。担当者様へ30秒だけご相談事項がありお電話しました。',
  },
  {
    id: 'intro',
    name: '導入トーク',
    isCustom: false,
    content:
      '本日は御社の業務効率化に関する情報提供です。現在の運用を3点だけお伺いし、合う場合のみご案内いたします。',
  },
  {
    id: 'objection',
    name: '反論対応',
    isCustom: false,
    content:
      '承知しました。ご不要のご判断でも問題ございません。最後に同業他社様の改善事例だけ共有してもよろしいでしょうか。',
  },
  {
    id: 'hearing',
    name: 'ヒアリング',
    isCustom: false,
    content:
      '現状の課題、運用人数、意思決定の流れを簡単に教えてください。最適なご提案範囲を絞ってお伝えします。',
  },
  {
    id: 'closing',
    name: 'クロージング',
    isCustom: false,
    content:
      '詳細は15分のオンラインでご説明します。候補として今週の火曜または木曜の午後でご都合はいかがでしょうか。',
  },
  {
    id: 'product',
    name: '商品説明',
    isCustom: false,
    content:
      '弊社はインサイドセールス向けCRMを提供しています。架電記録、再架電管理、レポートまで一元管理できます。',
  },
];

const getInfoPageUrl = (baseUrl: string): string => {
  const normalized = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalized}/info`;
};

type CompanyProfile = {
  companyName: string;
  companyPhone: string;
  companyAddress: string;
  targetUrl: string;
};

const DEFAULT_COMPANY: CompanyProfile = {
  companyName: '株式会社サンプル',
  companyPhone: '03-1234-5678',
  companyAddress: '東京都千代田区1-1-1',
  targetUrl: BASE_COMPANY_URL,
};

const CallingPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeMainTabId, setActiveMainTabId] = useState<string>(COMPANY_HP_TAB_ID);
  const [activeSubTabId, setActiveSubTabId] = useState<string>('reception');
  const [closingConditionChecked, setClosingConditionChecked] = useState<Record<string, boolean>>({
    datetime: false,
    contact: false,
    content: false,
  });
  const [customTabs, setCustomTabs] = useState<ScriptTab[]>([
    {
      id: 'custom-1',
      name: '自由書式1',
      isCustom: true,
      content: '顧客に合わせて自由にトークを記載してください。',
    },
  ]);
  const selectedResult = useCallingSessionStore((state) => state.selectedResult);
  const memo = useCallingSessionStore((state) => state.memo);
  const nextCallAt = useCallingSessionStore((state) => state.nextCallAt);
  const setSelectedResult = useCallingSessionStore((state) => state.setSelectedResult);
  const setMemo = useCallingSessionStore((state) => state.setMemo);
  const setNextCallAt = useCallingSessionStore((state) => state.setNextCallAt);
  const [isApproved, setIsApproved] = useState(false);
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const [callStarted, setCallStarted] = useState(false);
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const urlInput = useCallingSessionStore((state) => state.urlInput);
  const displayUrl = useCallingSessionStore((state) => state.displayUrl);
  const setUrlInput = useCallingSessionStore((state) => state.setUrlInput);
  const setDisplayUrl = useCallingSessionStore((state) => state.setDisplayUrl);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [volume, setVolume] = useState(0.2);
  const [isMuted, setIsMuted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('待機中');
  const [lastHelpRequestId, setLastHelpRequestId] = useState<string | null>(null);
  const [humanApprovalEnabled, setHumanApprovalEnabled] = useState(true);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [listId, setListId] = useState<string | null>(null);
  const [assignedListsForMe, setAssignedListsForMe] = useState<CallingList[]>([]);
  const [isLoadingAssignedLists, setIsLoadingAssignedLists] = useState(false);
  const [selectedAssignedListId, setSelectedAssignedListId] = useState('');
  const [recallList, setRecallList] = useState<CallingRecord[]>([]);
  const [isLoadingRecall, setIsLoadingRecall] = useState(false);
  const [showRecallPopup, setShowRecallPopup] = useState(false);
  /** 着信POPUP（無音・右上表示・会社ステータス＋メインに表示ボタン） */
  const [showIncomingPopup, setShowIncomingPopup] = useState(false);
  const [manualCompany, setManualCompany] = useState<CompanyProfile>(DEFAULT_COMPANY);
  const [viewMode, setViewMode] = useState<1 | 2>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const rightPanelsLayout = useDefaultLayout({
    id: 'calling-right-panels',
    panelIds: ['calling-right-top', 'calling-right-bottom'],
    storage:
      typeof window !== 'undefined'
        ? localStorage
        : { getItem: () => null, setItem: () => {} },
  });

  type DraftSnapshot = {
    memo: string;
    nextCallAt: string;
    selectedResult: CallingResultType;
    customTabs: ScriptTab[];
  };
  const DRAFT_HISTORY_MAX = 50;
  const draftHistoryRef = useRef<DraftSnapshot[]>([]);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const performSaveRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));
  const AUTO_SAVE_DELAY_MS = 2000;

  const selectedItem = listItems[currentItemIndex] ?? null;
  const companyProfile: CompanyProfile = selectedItem
    ? {
        companyName: selectedItem.companyName,
        companyPhone: selectedItem.phone,
        companyAddress: selectedItem.address,
        targetUrl: selectedItem.targetUrl,
      }
    : manualCompany;

  const pushDraftToHistory = () => {
    const snapshot: DraftSnapshot = {
      memo,
      nextCallAt,
      selectedResult,
      customTabs: JSON.parse(JSON.stringify(customTabs)),
    };
    draftHistoryRef.current = [snapshot, ...draftHistoryRef.current].slice(
      0,
      DRAFT_HISTORY_MAX,
    );
  };

  const applyDraftSnapshot = (snapshot: DraftSnapshot) => {
    setMemo(snapshot.memo);
    setNextCallAt(snapshot.nextCallAt);
    setSelectedResult(snapshot.selectedResult);
    setCustomTabs(snapshot.customTabs);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        const history = draftHistoryRef.current;
        if (history.length === 0) return;
        e.preventDefault();
        const prev = history[0];
        draftHistoryRef.current = history.slice(1);
        applyDraftSnapshot(prev);
        setStatusMessage('元に戻しました（Ctrl+Z）');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [memo, nextCallAt, selectedResult, customTabs]);

  useEffect(() => {
    if (!session?.accessToken || !companyProfile.companyName) return;
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveTimeoutRef.current = null;
      performSaveRef.current?.().catch(() => {});
    }, AUTO_SAVE_DELAY_MS);
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [memo, nextCallAt, selectedResult, session?.accessToken, companyProfile.companyName]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextListId = params.get('listId');
    const companyName = params.get('company');
    const companyUrl = params.get('url');
    setListId(nextListId);
    setSelectedAssignedListId(nextListId ?? '');

    if (!nextListId && companyName && companyUrl) {
      setManualCompany({
        companyName,
        companyPhone: DEFAULT_COMPANY.companyPhone,
        companyAddress: DEFAULT_COMPANY.companyAddress,
        targetUrl: companyUrl,
      });
      setUrlInput(companyUrl);
      setDisplayUrl(getInfoPageUrl(companyUrl));
      setStatusMessage(`再架電対象を読み込みました: ${companyName}`);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    const savedVolume = window.localStorage.getItem(BGM_VOLUME_KEY);
    if (!savedVolume) {
      return;
    }

    const parsed = Number(savedVolume);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      setVolume(parsed);
    }
  }, []);


  useEffect(() => {
    const audio = new Audio('/sounds/office-ambience.mp3');
    audio.loop = true;
    audio.volume = 0.2;

    const onError = (): void => {
      audioRef.current = null;
    };
    audio.addEventListener('error', onError);
    audioRef.current = audio;

    return () => {
      audio.removeEventListener('error', onError);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.volume = isMuted ? 0 : volume;
    window.localStorage.setItem(BGM_VOLUME_KEY, String(volume));
  }, [isMuted, volume]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) {
      return;
    }

    const loadCallingSettings = async (): Promise<void> => {
      try {
        const settings = await fetchCallingSettings(session.accessToken);
        setHumanApprovalEnabled(settings.humanApprovalEnabled);
      } catch {
        setStatusMessage('架電設定の取得に失敗しました。承認必須モードで継続します。');
        setHumanApprovalEnabled(true);
      }
    };

    void loadCallingSettings();
  }, [status, session?.accessToken]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken || !session?.user?.role) {
      return;
    }
    if (session.user.role !== 'is_member') {
      setAssignedListsForMe([]);
      setIsLoadingAssignedLists(false);
      return;
    }

    const loadAssignedLists = async (): Promise<void> => {
      setIsLoadingAssignedLists(true);
      try {
        if (USE_MOCK_KANBAN) {
          const lists = getMockAssignedLists();
          setAssignedListsForMe(lists);
          if (!listId && lists.length > 0) {
            setListId(lists[0].id);
            setSelectedAssignedListId(lists[0].id);
          }
        } else {
          const lists = await fetchAssignedCallingLists(session.accessToken);
          setAssignedListsForMe(lists);
          if (!listId && lists.length > 0) {
            setListId(lists[0].id);
            setSelectedAssignedListId(lists[0].id);
          }
        }
      } catch {
        setAssignedListsForMe([]);
        setStatusMessage('自分への配布リスト取得に失敗しました。');
      } finally {
        setIsLoadingAssignedLists(false);
      }
    };

    void loadAssignedLists();
  }, [status, session?.accessToken, session?.user?.role, listId]);

  // 再架電一覧取得（is_member のみ）。Phase2: USE_MOCK_KANBAN=false でAPIのみ
  useEffect(() => {
    if (status !== 'authenticated' || session?.user?.role !== 'is_member') {
      setRecallList([]);
      return;
    }
    const loadRecall = async (): Promise<void> => {
      setIsLoadingRecall(true);
      try {
        if (USE_MOCK_KANBAN) {
          setRecallList(getMockRecallList());
        } else if (session?.accessToken) {
          const list = await fetchRecallList(session.accessToken);
          setRecallList(list);
        } else {
          setRecallList([]);
        }
      } catch {
        setRecallList([]);
      } finally {
        setIsLoadingRecall(false);
      }
    };
    void loadRecall();
  }, [status, session?.accessToken, session?.user?.role]);

  // モック時は再架電を定期更新して揺れ・ポップアップ条件を維持（Phase2では削除 or WebSocketに置換可）
  useEffect(() => {
    if (!USE_MOCK_KANBAN || session?.user?.role !== 'is_member') return;
    const interval = setInterval(() => {
      setRecallList(getMockRecallList());
    }, 30 * 1000);
    return () => clearInterval(interval);
  }, [session?.user?.role]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) {
      return;
    }

    if (!listId) {
      setListItems([]);
      setCurrentItemIndex(0);
      return;
    }

    const loadListItems = async (): Promise<void> => {
      try {
        let items: ListItem[];
        if (USE_MOCK_KANBAN && listId.startsWith('mock-')) {
          items = getMockListItems(listId);
        } else {
          items = await fetchListItems(session.accessToken, listId);
        }
        setListItems(items);
        setCurrentItemIndex(0);
        if (items.length > 0) {
          setUrlInput(items[0].targetUrl);
          setDisplayUrl(getInfoPageUrl(items[0].targetUrl));
          setActiveMainTabId(COMPANY_HP_TAB_ID);
          setStatusMessage(`リスト連動で架電対象を読み込みました（${items.length}件）`);
        } else {
          setStatusMessage('リストに架電対象がありません。');
        }
      } catch {
        setStatusMessage('リスト明細の取得に失敗しました。');
      }
    };

    void loadListItems();
  }, [status, session?.accessToken, listId]);

  useEffect(() => {
    if (session?.user?.role !== 'is_member') {
      return;
    }
    setSelectedAssignedListId(listId ?? '');
  }, [session?.user?.role, listId]);

  useEffect(() => {
    setIframeLoaded(false);
    setIsApproved(false);
    setApprovalId(null);
    setApprovedAt(null);
    setLastHelpRequestId(null);
    setCallStarted(false);
  }, [displayUrl]);

  // 結果選択のキーボードショートカット（1〜7）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }
      const key = e.key;
      if (key >= '1' && key <= '7') {
        const index = parseInt(key, 10) - 1;
        if (RESULT_OPTIONS[index]) {
          e.preventDefault();
          setSelectedResult(RESULT_OPTIONS[index]);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setSelectedResult]);

  // 結果変更時に次回架電デフォルトとメモひな型を適用（ユーザー操作時のみ。初回はスキップ）
  const prevResultRef = useRef<CallingResultType | null>(null);
  useEffect(() => {
    if (prevResultRef.current !== null && prevResultRef.current !== selectedResult) {
      setNextCallAt(getDefaultNextCallAt(selectedResult));
      const currentMemo = useCallingSessionStore.getState().memo;
      if (currentMemo === '') {
        setMemo(MEMO_TEMPLATES[selectedResult]);
      }
    }
    prevResultRef.current = selectedResult;
  }, [selectedResult, setNextCallAt, setMemo]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.tenantId) {
      return;
    }

    const socket = io(getApiBaseUrl(), {
      transports: ['websocket'],
    });

    socket.on('director:joined', (event: { requestId: string; tenantId: string; requestedBy: string }) => {
      if (event.tenantId !== session.user.tenantId || event.requestedBy !== session.user.id) {
        return;
      }
      if (lastHelpRequestId && event.requestId !== lastHelpRequestId) {
        return;
      }
      setStatusMessage('ディレクターが参加しました。');
    });

    socket.on('call:ended', (event: { requestId: string; tenantId: string }) => {
      if (event.tenantId !== session.user.tenantId) {
        return;
      }
      if (lastHelpRequestId && event.requestId !== lastHelpRequestId) {
        return;
      }
      setStatusMessage('ディレクター対応が完了しました。');
    });

    socket.on('recall:reminder', (event: RecallReminderEvent) => {
      if (event.tenantId !== session.user.tenantId) {
        return;
      }

      const label = event.reminderType === '5min' ? '5分前' : '2分前';
      setStatusMessage(
        `再架電リマインド（${label}）: ${event.companyName} / ${new Date(event.nextCallAt).toLocaleString('ja-JP')}`,
      );
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(`再架電リマインド（${label}）`, {
          body: `${event.companyName} / ${new Date(event.nextCallAt).toLocaleString('ja-JP')}`,
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

      void (async () => {
        if (!session.accessToken) {
          return;
        }
        try {
          const lists = await fetchAssignedCallingLists(session.accessToken);
          setAssignedListsForMe(lists);
          if (!listId && lists.length > 0) {
            setListId(lists[0].id);
            setSelectedAssignedListId(lists[0].id);
          }
        } catch {
          setStatusMessage('配布リスト同期に失敗しました。');
        }
      })();

      setStatusMessage(`新しい配布リストを受信: ${event.listName}（配布者: ${event.assignedBy}）`);
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

      setAssignedListsForMe((current) => {
        const nextLists = current.filter((list) => list.id !== event.listId);
        if (listId === event.listId) {
          const fallbackListId = nextLists[0]?.id ?? null;
          setListId(fallbackListId);
          setSelectedAssignedListId(fallbackListId ?? '');
          setListItems([]);
          setCurrentItemIndex(0);
        }
        return nextLists;
      });
      setStatusMessage(`配布解除: ${event.listName}（解除者: ${event.unassignedBy}）`);
    });

    return () => {
      socket.disconnect();
    };
  }, [status, session?.accessToken, session?.user?.id, session?.user?.tenantId, session?.user?.email, listId, lastHelpRequestId]);

  useEffect(() => {
    if (iframeLoaded) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStatusMessage(
        'HPを埋め込み表示できない可能性があります。下の「外部リンクで開く」をご利用ください。',
      );
    }, 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [displayUrl, iframeLoaded]);

  const companyHpTab: ScriptTab = useMemo(
    () => ({ id: COMPANY_HP_TAB_ID, name: '企業HP', content: '', isCustom: false }),
    [],
  );
  const productTab: ScriptTab = useMemo(
    () => ({
      id: PRODUCT_TAB_ID,
      name: '商品説明',
      content: '',
      isCustom: false,
    }),
    [],
  );

  const mainTabs = useMemo<{ id: string; name: string; isCustom?: boolean }[]>(() => {
    const fixedMain = [
      companyHpTab,
      { id: MAIN_TAB_A, name: 'A（オープニング）' },
      { id: MAIN_TAB_B, name: 'B（本論）' },
      { id: MAIN_TAB_C, name: 'C（締め）' },
      productTab,
    ];
    return [...fixedMain, ...customTabs];
  }, [companyHpTab, productTab, customTabs]);

  const subTabs = useMemo(
    () => SUB_TABS_BY_MAIN[activeMainTabId] ?? [],
    [activeMainTabId],
  );

  const effectiveSubTabId = useMemo(() => {
    if (subTabs.length === 0) return '';
    const found = subTabs.some((s) => s.id === activeSubTabId);
    return found ? activeSubTabId : subTabs[0].id;
  }, [subTabs, activeSubTabId]);

  const scriptContentTab = useMemo(() => {
    if (effectiveSubTabId && ['reception', 'intro', 'objection', 'hearing', 'closing'].includes(effectiveSubTabId)) {
      return fixedTabs.find((t) => t.id === effectiveSubTabId) ?? null;
    }
    if (activeMainTabId.startsWith('custom-')) {
      return customTabs.find((t) => t.id === activeMainTabId) ?? null;
    }
    return null;
  }, [effectiveSubTabId, activeMainTabId, customTabs]);

  const isCompanyHpTab = activeMainTabId === COMPANY_HP_TAB_ID;
  const isProductTab = activeMainTabId === PRODUCT_TAB_ID;
  const isClosingSubTab = effectiveSubTabId === 'closing';
  const isClientInfoSubTab = effectiveSubTabId === 'client-info';
  const isPjInfoSubTab = effectiveSubTabId === 'pj-info';

  const currentScriptTabLabel = useMemo(() => {
    if (subTabs.length && effectiveSubTabId) {
      const sub = subTabs.find((s) => s.id === effectiveSubTabId);
      if (sub) return sub.name;
    }
    if (scriptContentTab) return scriptContentTab.name;
    const main = mainTabs.find((t) => t.id === activeMainTabId);
    return main?.name ?? '—';
  }, [subTabs, effectiveSubTabId, scriptContentTab, mainTabs, activeMainTabId]);

  const handleStartBgm = async () => {
    if (!audioRef.current) {
      setStatusMessage('BGMファイルがありません。（/sounds/office-ambience.mp3 を配置すると再生できます）');
      return;
    }
    try {
      await audioRef.current.play();
      setStatusMessage('BGM再生を開始しました。');
    } catch {
      setStatusMessage('BGMを再生できませんでした。音声ファイルの配置を確認してください。');
    }
  };

  const handleStopBgm = () => {
    if (!audioRef.current) {
      return;
    }
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setStatusMessage('BGMを停止しました。');
  };

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextVolume = Number(event.target.value);
    if (Number.isNaN(nextVolume)) {
      return;
    }
    setVolume(nextVolume);
  };

  const handleAssignedListChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const nextListId = event.target.value;
    setSelectedAssignedListId(nextListId);
    setListId(nextListId || null);

    const nextParams = new URLSearchParams(window.location.search);
    if (nextListId) {
      nextParams.set('listId', nextListId);
    } else {
      nextParams.delete('listId');
    }
    const nextQuery = nextParams.toString();
    window.history.replaceState({}, '', nextQuery ? `/calling?${nextQuery}` : '/calling');
  };

  /** 看板の配布リストカードをクリックしたとき */
  const handleSelectListCard = (nextListId: string): void => {
    setSelectedAssignedListId(nextListId);
    setListId(nextListId);
    const nextParams = new URLSearchParams(window.location.search);
    nextParams.set('listId', nextListId);
    window.history.replaceState({}, '', `/calling?${nextParams.toString()}`);
  };

  /** 再架電エリアをクリックしたとき（未架電の再架電があればポップアップ） */
  const handleRecallAreaClick = (): void => {
    const now = Date.now();
    const oneMinuteMs = 60 * 1000;
    const hasOverdueRecall = recallList.some((r) => r.nextCallAt && new Date(r.nextCallAt).getTime() < now + oneMinuteMs);
    if (hasOverdueRecall) {
      setShowRecallPopup(true);
    }
  };

  const handleAddCustomTab = () => {
    if (mainTabs.length >= 10) {
      setStatusMessage('タブは最大10枚までです。');
      return;
    }

    const nextIndex = customTabs.length + 1;
    const nextTab: ScriptTab = {
      id: `custom-${nextIndex}`,
      name: `自由書式${nextIndex}`,
      isCustom: true,
      content: '',
    };
    setCustomTabs((prev) => [...prev, nextTab]);
    setActiveMainTabId(nextTab.id);
  };

  const handleRenameCustomTab = (tabId: string, nextName: string) => {
    pushDraftToHistory();
    setCustomTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, name: nextName || '自由書式' } : tab)),
    );
  };

  const handleTabContentChange = (tabId: string, nextContent: string) => {
    if (!customTabs.some((tab) => tab.id === tabId && tab.isCustom)) {
      return;
    }
    pushDraftToHistory();
    setCustomTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, content: nextContent } : tab)),
    );
  };

  const handleMainTabChange = (mainId: string) => {
    setActiveMainTabId(mainId);
    const subs = SUB_TABS_BY_MAIN[mainId];
    if (subs?.length) {
      setActiveSubTabId(subs[0].id);
    }
  };

  const handleClosingConditionChange = (id: string, checked: boolean) => {
    setClosingConditionChecked((prev) => ({ ...prev, [id]: checked }));
  };

  const handleApplyInfoPage = () => {
    setDisplayUrl(getInfoPageUrl(urlInput));
    setStatusMessage('INFOページ候補を表示しました。');
  };

  const handleApplyTopPage = () => {
    setDisplayUrl(urlInput);
    setStatusMessage('トップページURLを表示しました。');
  };

  const handleApprove = async (): Promise<void> => {
    // #region agent log
    fetch('http://127.0.0.1:7790/ingest/7094b1fb-325d-446a-815b-bc3be8ae2d53',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64b74a'},body:JSON.stringify({sessionId:'64b74a',location:'page.tsx:handleApprove',message:'handleApprove entry',data:{hasSession:!!session?.accessToken},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    if (!session?.accessToken) {
      setStatusMessage('アクセストークンが見つからないため承認できません。');
      return;
    }

    try {
      const approval = await createCallingApproval(session.accessToken, {
        companyName: companyProfile.companyName,
        targetUrl: displayUrl,
      });
      // #region agent log
      fetch('http://127.0.0.1:7790/ingest/7094b1fb-325d-446a-815b-bc3be8ae2d53',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64b74a'},body:JSON.stringify({sessionId:'64b74a',location:'page.tsx:handleApprove:success',message:'createCallingApproval success',data:{approvalId:approval?.id},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      setIsApproved(true);
      setApprovalId(approval.id);
      setApprovedAt(approval.approvedAt);
      setStatusMessage(`承認済み: ${new Date(approval.approvedAt).toLocaleString('ja-JP')}`);
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7790/ingest/7094b1fb-325d-446a-815b-bc3be8ae2d53',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64b74a'},body:JSON.stringify({sessionId:'64b74a',location:'page.tsx:handleApprove:catch',message:'createCallingApproval failed',data:{err:String(e)},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      setIsApproved(false);
      setApprovalId(null);
      setApprovedAt(null);
      setStatusMessage('承認保存に失敗しました。');
    }
  };

  const handleDial = async (): Promise<void> => {
    if (!session?.accessToken) {
      setStatusMessage('アクセストークンが見つからないため発信できません。');
      return;
    }

    const startZoomDialSession = async (): Promise<void> => {
      const zoomSession = await createZoomDialSession(session.accessToken, {
        companyName: companyProfile.companyName,
        targetUrl: displayUrl,
      });
      window.open(zoomSession.startUrl, '_blank', 'noopener,noreferrer');
      setCallStarted(true);
      setStatusMessage(
        `発信セッションを開始しました。ボタンが「発信切断」に切り替わりました。`,
      );
    };

    if (!humanApprovalEnabled) {
      try {
        await startZoomDialSession();
        return;
      } catch {
        setStatusMessage('発信処理に失敗しました。');
        return;
      }
    }

    if (!approvalId) {
      setStatusMessage('承認が未完了のため発信できません。');
      return;
    }

    try {
      const result = await validateDialPermission(session.accessToken, {
        approvalId,
        targetUrl: displayUrl,
      });

      if (!result.canDial) {
        setStatusMessage(result.reason ?? '承認確認に失敗したため発信できません。');
        return;
      }

      await startZoomDialSession();
    } catch {
      setStatusMessage('発信処理に失敗しました。');
    }
  };

  const performSave = async (): Promise<boolean> => {
    if (!session?.accessToken) {
      setStatusMessage('アクセストークンが見つからないため保存できません。');
      return false;
    }
    try {
      const saved = await saveCallingRecord(session.accessToken, {
        companyName: companyProfile.companyName,
        companyPhone: companyProfile.companyPhone,
        companyAddress: companyProfile.companyAddress,
        targetUrl: displayUrl,
        approved: humanApprovalEnabled ? isApproved : true,
        approvedAt: approvedAt ?? undefined,
        result: selectedResult,
        memo: memo || undefined,
        nextCallAt: nextCallAt ? new Date(nextCallAt).toISOString() : undefined,
      });
      setStatusMessage(`保存完了: ${saved.id}`);
      return true;
    } catch {
      setStatusMessage('保存に失敗しました。API接続を確認してください。');
      return false;
    }
  };
  performSaveRef.current = performSave;

  const handleSaveRecord = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await performSave();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndNext = async (): Promise<void> => {
    setIsSaving(true);
    try {
      const ok = await performSave();
      if (ok) {
        handleNextCompany();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleHelpRequest = async (): Promise<void> => {
    if (!session?.accessToken) {
      setStatusMessage('アクセストークンが見つからないため呼出できません。');
      return;
    }

    try {
      const request = await createHelpRequest(session.accessToken, {
        companyName: companyProfile.companyName,
        scriptTab: currentScriptTabLabel,
      });

      setLastHelpRequestId(request.id);
      setStatusMessage(
        `ディレクター呼出を送信しました。キュー番号: ${request.queueNumber}（${request.scriptTab}）`,
      );
    } catch {
      setStatusMessage('ディレクター呼出の送信に失敗しました。');
    }
  };

  const handlePrevCompany = (): void => {
    if (listItems.length === 0) return;
    setCallStarted(false);
    const prevIndex =
      currentItemIndex <= 0 ? listItems.length - 1 : currentItemIndex - 1;
    const prevItem = listItems[prevIndex];
    setCurrentItemIndex(prevIndex);
    setUrlInput(prevItem.targetUrl);
    setDisplayUrl(getInfoPageUrl(prevItem.targetUrl));
    setSelectedResult('不在');
    setMemo('');
    setNextCallAt('');
    setActiveMainTabId(COMPANY_HP_TAB_ID);
    setStatusMessage(
      `前の企業へ: ${prevItem.companyName} (${prevIndex + 1}/${listItems.length})`,
    );
  };

  const handleNextCompany = (): void => {
    if (listItems.length === 0) {
      setStatusMessage('次の企業へ移動しました。（MVPダミー）');
      return;
    }
    setCallStarted(false);

    const nextIndex = (currentItemIndex + 1) % listItems.length;
    const nextItem = listItems[nextIndex];
    setCurrentItemIndex(nextIndex);
    setUrlInput(nextItem.targetUrl);
    setDisplayUrl(getInfoPageUrl(nextItem.targetUrl));
    setSelectedResult('不在');
    setMemo('');
    setNextCallAt('');
    setActiveMainTabId(COMPANY_HP_TAB_ID);
    setStatusMessage(
      `次の企業へ移動: ${nextItem.companyName} (${nextIndex + 1}/${listItems.length})`,
    );
  };

  if (status !== 'authenticated' || !session.user) {
    return <main className="p-6">読み込み中...</main>;
  }

  // UI2: 独立した別レイアウト（CallingPageV2）。UI1 と別途改修して育てる
  if (viewMode === 2) {
    return (
      <main className="min-h-screen bg-slate-100 p-4">
        <div className="fixed top-4 right-4 z-50 flex gap-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 shadow-md">
          <span className="px-1 text-xs text-slate-500">UI:</span>
          <button
            type="button"
            onClick={() => setViewMode(1)}
            className="rounded px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            1
          </button>
          <button
            type="button"
            onClick={() => setViewMode(2)}
            className="rounded bg-blue-600 px-2 py-1 text-sm font-medium text-white"
          >
            2
          </button>
        </div>
        <CallingPageV2 />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4">
      <div className="fixed top-4 right-4 z-50 flex gap-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 shadow-md">
        <span className="px-1 text-xs text-slate-500">UI:</span>
        <button
          type="button"
          onClick={() => setViewMode(1)}
          className="rounded bg-blue-600 px-2 py-1 text-sm font-medium text-white"
        >
          1
        </button>
        <button
          type="button"
          onClick={() => setViewMode(2)}
          className="rounded px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          2
        </button>
      </div>
      <div className="flex h-[calc(100vh-7rem)] gap-3">
        <section className="flex w-2/5 min-w-[360px] flex-col gap-3 overflow-y-auto rounded border border-slate-200 bg-white p-4 relative">
          {SHOW_SECTION_LABELS && (
            <span className="sticky top-0 z-10 -mx-4 -mt-4 mb-1 block bg-white px-4 py-1 text-xs font-medium text-black">
              左カラム 上
            </span>
          )}
          {listId && listItems.length > 0 && (
            <p className="text-xs text-slate-500">
              リスト連動: {currentItemIndex + 1}/{listItems.length}
            </p>
          )}
          {session.user.role === 'is_member' && (
            <div className="rounded border border-slate-200 p-3">
              <style>{`
                @keyframes recall-shake {
                  0%, 90%, 100% { transform: translateX(0); }
                  92% { transform: translateX(-3px); }
                  94% { transform: translateX(3px); }
                  96% { transform: translateX(-2px); }
                  98% { transform: translateX(2px); }
                }
                .recall-card-due {
                  animation: recall-shake 3s ease-in-out infinite;
                }
              `}</style>
              <h2 className="text-sm font-semibold text-slate-700">自分への配布リスト</h2>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {/* 左: 再架電エリア（看板の一番左に溜まる） */}
                <div className="shrink-0 space-y-1.5">
                  <p className="text-xs font-medium text-slate-600">再架電</p>
                  {isLoadingRecall ? (
                    <p className="text-xs text-slate-400">読み込み中...</p>
                  ) : recallList.length === 0 ? (
                    <p className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-400">
                      再架電なし
                    </p>
                  ) : (
                    <div className="flex max-h-[200px] flex-col gap-1.5 overflow-y-auto">
                      {recallList.map((r) => {
                        const nextAt = r.nextCallAt ? new Date(r.nextCallAt).getTime() : 0;
                        const now = Date.now();
                        const twoMinMs = 2 * 60 * 1000;
                        const isDueSoon = nextAt > 0 && nextAt - now <= twoMinMs && nextAt - now > 0;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={handleRecallAreaClick}
                            className={`rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-left text-xs shadow-sm hover:bg-amber-100 ${
                              isDueSoon ? 'recall-card-due border-amber-400' : ''
                            }`}
                          >
                            <p className="font-medium text-slate-800 truncate">{r.companyName}</p>
                            <p className="mt-0.5 text-slate-500">
                              {r.nextCallAt ? new Date(r.nextCallAt).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* 右: 配布リストカード */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-xs font-medium text-slate-600">配布リスト</p>
                  {isLoadingAssignedLists ? (
                    <p className="text-xs text-slate-400">読み込み中...</p>
                  ) : assignedListsForMe.length === 0 ? (
                    <p className="text-xs text-slate-400">配布リストはありません。</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {assignedListsForMe.map((list) => (
                        <button
                          key={list.id}
                          type="button"
                          onClick={() => handleSelectListCard(list.id)}
                          className={`rounded border px-3 py-2.5 text-left text-xs shadow-sm transition-colors ${
                            selectedAssignedListId === list.id
                              ? 'border-blue-500 bg-blue-50 text-blue-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <p className="font-medium truncate max-w-[140px]">{list.name}</p>
                          <p className="mt-0.5 text-slate-500">{list.itemCount}件</p>
                          {list.assignedBy && (
                            <p className="mt-0.5 text-slate-400">配布: {list.assignedBy}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* 再架電・未架電時ポップアップ */}
              {showRecallPopup && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="recall-popup-title"
                >
                  <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
                    <p
                      id="recall-popup-title"
                      className="text-center font-medium leading-relaxed text-slate-700"
                      style={{ fontFamily: '"Hiragino Maru Gothic ProN", "M PLUS Rounded 1c", sans-serif', fontWeight: 400 }}
                    >
                      再架電先を表示します。準備してお待ちください。
                    </p>
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setShowRecallPopup(false)}
                        className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
                      >
                        閉じる
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded border border-slate-200 p-3">
            <h2 className="text-sm font-semibold text-slate-700">リスト内容確認フロー</h2>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                disabled={listItems.length === 0}
                className="shrink-0 rounded border border-slate-400 px-2 py-1.5 text-slate-600 disabled:opacity-50"
                onClick={handlePrevCompany}
                title="前の企業"
              >
                ◀
              </button>
              <span className="min-w-0 flex-1 text-center text-xs text-slate-600">
                リスト内容確認 確認終わったら
              </span>
              <button
                type="button"
                className={`shrink-0 rounded px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400 ${
                  callStarted
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : isApproved && approvalId
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
                onClick={() => {
                  // #region agent log
                  const branch = callStarted ? 'callStarted' : (!humanApprovalEnabled || (isApproved && approvalId)) ? 'handleDial' : 'handleApprove';
                  fetch('http://127.0.0.1:7790/ingest/7094b1fb-325d-446a-815b-bc3be8ae2d53',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64b74a'},body:JSON.stringify({sessionId:'64b74a',location:'page.tsx:flowConfirmButton',message:'flow button click',data:{branch,isApproved:!!isApproved,hasApprovalId:!!approvalId},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
                  // #endregion
                  if (callStarted) {
                    setCallStarted(false);
                    setStatusMessage('発信を切断しました。');
                    return;
                  }
                  if (!humanApprovalEnabled || (isApproved && approvalId)) {
                    void handleDial();
                  } else {
                    void handleApprove();
                  }
                }}
              >
                {callStarted
                  ? '発信切断'
                  : !humanApprovalEnabled || (isApproved && approvalId)
                    ? '発信'
                    : 'フロー確認承認'}
              </button>
              <button
                type="button"
                className="shrink-0 rounded border border-slate-400 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setShowIncomingPopup(true)}
                title="着信時は右上に無音でポップアップ表示"
              >
                着信
              </button>
              <button
                type="button"
                disabled={listItems.length === 0}
                className="shrink-0 rounded border border-slate-400 px-2 py-1.5 text-slate-600 disabled:opacity-50"
                onClick={handleNextCompany}
                title="次の企業"
              >
                ▶
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              {isApproved && approvedAt
                ? `承認日時: ${new Date(approvedAt).toLocaleString('ja-JP')}`
                : humanApprovalEnabled
                  ? '未承認'
                  : '承認不要（OFF）'}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              他のページ:{' '}
              <Link href="/dashboard" className="text-blue-600 underline">ダッシュボード</Link>
              {' | '}
              <Link href="/recall" className="text-blue-600 underline">再架電</Link>
              {' | '}
              <Link href="/reports" className="text-blue-600 underline">レポート</Link>
            </p>
          </div>

          {SHOW_SECTION_LABELS && (
            <span className="block text-xs font-medium text-black">左カラム 下</span>
          )}
          <div className="rounded border border-slate-200 p-3">
            <h2 className="text-sm font-semibold text-slate-700">企業情報</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">会社名</dt>
                <dd className="font-medium">{companyProfile.companyName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">電話番号</dt>
                <dd className="font-medium">{companyProfile.companyPhone}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">住所</dt>
                <dd className="font-medium">{companyProfile.companyAddress}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded border border-slate-200 p-3">
            <h2 className="text-sm font-semibold text-slate-700">結果記録</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {RESULT_OPTIONS.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="calling-result"
                    value={option}
                    checked={selectedResult === option}
                    onChange={() => {
                    pushDraftToHistory();
                    setSelectedResult(option);
                  }}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            <label htmlFor="memo" className="mt-3 block text-sm font-medium">
              メモ
            </label>
            <textarea
              id="memo"
              value={memo}
              onChange={(event) => {
                pushDraftToHistory();
                setMemo(event.target.value);
              }}
              className="neo-trigger mt-1 h-20 w-full rounded border border-slate-300 p-2 text-sm"
              placeholder="ヒアリング内容を記録"
            />
            <label htmlFor="next-call" className="mt-3 block text-sm font-medium">
              次回架電
            </label>
            <input
              id="next-call"
              type="datetime-local"
              value={nextCallAt}
              onChange={(event) => {
                pushDraftToHistory();
                setNextCallAt(event.target.value);
              }}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
            />
          </div>

        </section>

        <section className="relative w-3/5 min-w-[520px] flex flex-col rounded border border-slate-200 bg-white p-2 min-h-[480px]">
          {SHOW_SECTION_LABELS && (
            <span className="absolute left-2 top-2 z-10 text-xs font-medium text-black">右メイン</span>
          )}
          <Group
            orientation="vertical"
            id="calling-right-panels"
            defaultLayout={rightPanelsLayout.defaultLayout}
            onLayoutChanged={rightPanelsLayout.onLayoutChanged}
          >
            <Panel id="calling-right-top" defaultSize={70} minSize={25}>
              <div className="flex h-full flex-col min-h-0">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(event) => setUrlInput(event.target.value)}
                    className="min-w-56 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                    placeholder="https://example.com"
                  />
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                    onClick={handleApplyInfoPage}
                  >
                    INFOページ優先表示
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                    onClick={handleApplyTopPage}
                  >
                    トップページ表示
                  </button>
                  <a
                    href={displayUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded bg-slate-800 px-2 py-1 text-xs text-white"
                  >
                    外部リンクで開く
                  </a>
                </div>
                <div className="relative flex-1 min-h-[200px]">
                  {!iframeLoaded && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded border border-slate-200 bg-slate-50">
                      <div className="flex flex-col items-center gap-2 text-slate-600">
                        <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                        <span className="text-sm">ページを読み込み中...</span>
                      </div>
                    </div>
                  )}
                  <iframe
                    title="企業HP"
                    src={displayUrl}
                    className="h-full w-full min-h-[200px]"
                    onLoad={() => {
                      setIframeLoaded(true);
                      setStatusMessage('企業HPを表示しました。');
                    }}
                  />
                </div>
              </div>
            </Panel>
            <Separator className="h-3 min-h-[12px] shrink-0 bg-slate-200 hover:bg-slate-300 transition-colors" />
            <Panel id="calling-right-bottom" defaultSize={30} minSize={15}>
              <div className="flex h-full flex-col min-h-0">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-2">
                  {mainTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`rounded px-2 py-1 text-xs ${
                        activeMainTabId === tab.id
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-300 text-slate-700'
                      }`}
                      onClick={() => handleMainTabChange(tab.id)}
                    >
                      {tab.name}
                    </button>
                  ))}
                  {mainTabs.length < 10 && (
                    <button
                      type="button"
                      className="rounded border border-dashed border-slate-400 px-2 py-1 text-xs"
                      onClick={handleAddCustomTab}
                    >
                      + タブ追加
                    </button>
                  )}
                </div>
                {subTabs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 p-2">
                    {subTabs.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        className={`rounded px-2 py-1 text-xs ${
                          effectiveSubTabId === sub.id
                            ? 'bg-slate-600 text-white'
                            : 'border border-slate-300 text-slate-700'
                        }`}
                        onClick={() => setActiveSubTabId(sub.id)}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex-1 flex flex-col min-h-0 overflow-auto">
                  {isCompanyHpTab ? (
                    <p className="p-3 text-sm text-slate-500">企業HPは上で表示しています。</p>
                  ) : isProductTab && isClientInfoSubTab ? (
              <div className="flex-1 overflow-y-auto p-3">
                <h3 className="text-sm font-semibold text-slate-700">クライアント情報</h3>
                <dl className="mt-2 space-y-1 text-sm text-slate-600">
                  <div>
                    <dt className="font-medium">会社名</dt>
                    <dd>{companyProfile.companyName}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">電話番号</dt>
                    <dd>{companyProfile.companyPhone}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">住所</dt>
                    <dd>{companyProfile.companyAddress}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">URL</dt>
                    <dd>
                      <a
                        href={companyProfile.targetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline"
                      >
                        {companyProfile.targetUrl}
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
            ) : isProductTab && isPjInfoSubTab ? (
              <div className="flex-1 overflow-y-auto p-3">
                <p className="text-sm text-slate-600">
                  PJインフォ（ディレクターが登録した項目がここに表示されます）
                </p>
              </div>
            ) : isClosingSubTab && scriptContentTab ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {scriptContentTab.content}
                </p>
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <h4 className="text-xs font-semibold text-slate-600 mb-2">アポ条件（アポと紐付けて記録・条件回収率）</h4>
                  <div className="flex flex-wrap gap-4">
                    {CLOSING_APPO_CONDITIONS.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={closingConditionChecked[c.id] ?? false}
                          onChange={(e) => handleClosingConditionChange(c.id, e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : scriptContentTab?.isCustom ? (
              <div className="flex-1 overflow-y-auto p-3">
                {scriptContentTab && (
                  <div className="space-y-2">
                    <input
                      value={scriptContentTab.name}
                      onChange={(event) =>
                        handleRenameCustomTab(scriptContentTab.id, event.target.value)
                      }
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      placeholder="タブ名"
                    />
                    <textarea
                      value={scriptContentTab.content}
                      onChange={(event) =>
                        handleTabContentChange(scriptContentTab.id, event.target.value)
                      }
                      className="neo-trigger h-36 w-full rounded border border-slate-300 p-2 text-sm"
                      placeholder="自由書式のトークを入力"
                    />
                  </div>
                )}
              </div>
            ) : scriptContentTab ? (
              <div className="flex-1 overflow-y-auto p-3">
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {scriptContentTab.content}
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3">
                <p className="text-sm text-slate-500">コンテンツを選択してください。</p>
              </div>
            )}
                </div>
              </div>
            </Panel>
          </Group>
        </section>
      </div>

      {/* フッタセクション（色分けしたセクションのみ） */}
      <footer data-area="footer" className="mt-3 flex flex-wrap gap-2">
        <section className="min-h-[48px] min-w-[120px] flex-1 rounded border border-slate-200 bg-blue-500/10 p-2" aria-label="フッタセクション1" />
        <section className="min-h-[48px] min-w-[120px] flex-1 rounded border border-slate-200 bg-amber-500/10 p-2" aria-label="フッタセクション2" />
        <section className="min-h-[48px] min-w-[120px] flex-1 rounded border border-slate-200 bg-emerald-500/10 p-2" aria-label="フッタセクション3" />
      </footer>

      {/* 着信POPUP：無音・右上固定・会社ステータス＋メインに表示ボタン */}
      {showIncomingPopup && (
        <div
          className="fixed right-4 top-4 z-50 w-72 rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
          role="dialog"
          aria-label="着信"
        >
          <p className="text-xs font-medium text-slate-500">着信</p>
          <p className="mt-1 font-medium text-slate-800">{companyProfile.companyName}</p>
          <p className="mt-0.5 text-sm text-slate-600">{companyProfile.companyPhone}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{companyProfile.targetUrl || '—'}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => setShowIncomingPopup(false)}
            >
              閉じる
            </button>
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              onClick={() => {
                setShowIncomingPopup(false);
                setStatusMessage(`メインに表示: ${companyProfile.companyName}`);
              }}
            >
              メインに表示
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

export default CallingPage;
