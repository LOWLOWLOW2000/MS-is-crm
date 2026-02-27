'use client';

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Group, type Layout, Panel, Separator } from 'react-resizable-panels';
import { io } from 'socket.io-client';
import {
  createCallingApproval,
  createHelpRequest,
  fetchAssignedCallingLists,
  fetchListItems,
  fetchCallingSettings,
  getApiBaseUrl,
  saveCallingRecord,
  validateDialPermission,
} from '@/lib/calling-api';
import type { CallingList, CallingResultType, ListAssignedEvent, ListItem, RecallReminderEvent } from '@/lib/types';
import { useCallingSessionStore } from '@/lib/stores/calling-session-store';

type ScriptTab = {
  id: string;
  name: string;
  content: string;
  isCustom: boolean;
};

const BGM_VOLUME_KEY = 'calling-bgm-volume';
const RIGHT_LAYOUT_KEY = 'calling-right-panel-layout';
const BASE_COMPANY_URL = 'https://example.com';
const RESULT_OPTIONS: CallingResultType[] = [
  '担当者あり興味',
  '担当者あり不要',
  '不在',
  '番号違い',
  '断り',
  '折り返し依頼',
  '留守電',
];

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
  const [activeTabId, setActiveTabId] = useState<string>(fixedTabs[0].id);
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
  const [rightPanelLayout, setRightPanelLayout] = useState<Layout | undefined>(undefined);
  const [humanApprovalEnabled, setHumanApprovalEnabled] = useState(true);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [listId, setListId] = useState<string | null>(null);
  const [assignedListsForMe, setAssignedListsForMe] = useState<CallingList[]>([]);
  const [isLoadingAssignedLists, setIsLoadingAssignedLists] = useState(false);
  const [selectedAssignedListId, setSelectedAssignedListId] = useState('');
  const [manualCompany, setManualCompany] = useState<CompanyProfile>(DEFAULT_COMPANY);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedItem = listItems[currentItemIndex] ?? null;
  const companyProfile: CompanyProfile = selectedItem
    ? {
        companyName: selectedItem.companyName,
        companyPhone: selectedItem.phone,
        companyAddress: selectedItem.address,
        targetUrl: selectedItem.targetUrl,
      }
    : manualCompany;

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
    const savedLayout = window.localStorage.getItem(RIGHT_LAYOUT_KEY);
    if (!savedLayout) {
      return;
    }

    try {
      const parsed = JSON.parse(savedLayout) as Layout;
      setRightPanelLayout(parsed);
    } catch {
      setStatusMessage('右ペインの分割設定を読み込めませんでした。初期値で表示します。');
    }
  }, []);

  useEffect(() => {
    const audio = new Audio('/sounds/office-ambience.mp3');
    audio.loop = true;
    audio.volume = 0.2;
    audioRef.current = audio;

    return () => {
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
        const lists = await fetchAssignedCallingLists(session.accessToken);
        setAssignedListsForMe(lists);
        if (!listId && lists.length > 0) {
          setListId(lists[0].id);
          setSelectedAssignedListId(lists[0].id);
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
        const items = await fetchListItems(session.accessToken, listId);
        setListItems(items);
        setCurrentItemIndex(0);
        if (items.length > 0) {
          setUrlInput(items[0].targetUrl);
          setDisplayUrl(getInfoPageUrl(items[0].targetUrl));
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
  }, [displayUrl]);

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
    });

    socket.on('list:assigned', (event: ListAssignedEvent) => {
      if (event.tenantId !== session.user.tenantId || event.assigneeEmail !== session.user.email) {
        return;
      }

      setAssignedListsForMe((current) => {
        const withoutSame = current.filter((list) => list.id !== event.listId);
        const next: CallingList = {
          id: event.listId,
          tenantId: event.tenantId,
          name: event.listName,
          sourceType: 'csv',
          createdBy: '',
          createdAt: event.assignedAt,
          itemCount: 0,
          assigneeEmail: event.assigneeEmail,
          assignedBy: event.assignedBy,
          assignedAt: event.assignedAt,
        };
        return [next, ...withoutSame].slice(0, 20);
      });

      setStatusMessage(`新しい配布リストを受信: ${event.listName}（配布者: ${event.assignedBy}）`);
    });

    return () => {
      socket.disconnect();
    };
  }, [status, session?.user?.id, session?.user?.tenantId, session?.user?.email, lastHelpRequestId]);

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

  const tabs = useMemo<ScriptTab[]>(() => {
    return [...fixedTabs, ...customTabs];
  }, [customTabs]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  const handleStartBgm = async () => {
    if (!audioRef.current) {
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

  const handleAddCustomTab = () => {
    if (tabs.length >= 10) {
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
    setActiveTabId(nextTab.id);
  };

  const handleRenameCustomTab = (tabId: string, nextName: string) => {
    setCustomTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, name: nextName || '自由書式' } : tab)),
    );
  };

  const handleTabContentChange = (tabId: string, nextContent: string) => {
    if (!tabs.some((tab) => tab.id === tabId && tab.isCustom)) {
      return;
    }

    setCustomTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, content: nextContent } : tab)),
    );
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
    if (!session?.accessToken) {
      setStatusMessage('アクセストークンが見つからないため承認できません。');
      return;
    }

    try {
      const approval = await createCallingApproval(session.accessToken, {
        companyName: companyProfile.companyName,
        targetUrl: displayUrl,
      });

      setIsApproved(true);
      setApprovalId(approval.id);
      setApprovedAt(approval.approvedAt);
      setStatusMessage(`承認済み: ${new Date(approval.approvedAt).toLocaleString('ja-JP')}`);
    } catch {
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

    if (!humanApprovalEnabled) {
      setStatusMessage('ZOOM発信を開始しました。（承認フローOFF / MVPダミー挙動）');
      return;
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

      setStatusMessage('ZOOM発信を開始しました。（MVPダミー挙動）');
    } catch {
      setStatusMessage('発信可否の確認に失敗しました。');
    }
  };

  const handleSaveRecord = async (): Promise<void> => {
    if (!session?.accessToken) {
      setStatusMessage('アクセストークンが見つからないため保存できません。');
      return;
    }

    setIsSaving(true);
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
    } catch {
      setStatusMessage('保存に失敗しました。API接続を確認してください。');
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
        scriptTab: activeTab.name,
      });

      setLastHelpRequestId(request.id);
      setStatusMessage(
        `ディレクター呼出を送信しました。キュー番号: ${request.queueNumber}（${request.scriptTab}）`,
      );
    } catch {
      setStatusMessage('ディレクター呼出の送信に失敗しました。');
    }
  };

  const handleNextCompany = (): void => {
    if (listItems.length === 0) {
      setStatusMessage('次の企業へ移動しました。（MVPダミー）');
      return;
    }

    const nextIndex = (currentItemIndex + 1) % listItems.length;
    const nextItem = listItems[nextIndex];
    setCurrentItemIndex(nextIndex);
    setUrlInput(nextItem.targetUrl);
    setDisplayUrl(getInfoPageUrl(nextItem.targetUrl));
    setSelectedResult('不在');
    setMemo('');
    setNextCallAt('');
    setStatusMessage(
      `次の企業へ移動: ${nextItem.companyName} (${nextIndex + 1}/${listItems.length})`,
    );
  };

  const handleRightPanelLayoutChange = useCallback((layout: Layout) => {
    setRightPanelLayout(layout);
    window.localStorage.setItem(RIGHT_LAYOUT_KEY, JSON.stringify(layout));
  }, []);

  if (status !== 'authenticated' || !session.user) {
    return <main className="p-6">読み込み中...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4">
      <div className="mb-3 flex items-center justify-between rounded border border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-xl font-bold">架電専用UI</h1>
          <p className="text-sm text-slate-600">
            担当: {session.user.name} / tenant: {session.user.tenantId} / role: {session.user.role}
          </p>
          {listId && listItems.length > 0 && (
            <p className="text-xs text-slate-500">
              リスト連動: {currentItemIndex + 1}/{listItems.length}
            </p>
          )}
        </div>
        <button
          type="button"
          className="rounded bg-slate-800 px-4 py-2 text-sm text-white"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          ログアウト
        </button>
      </div>

      <div className="flex h-[calc(100vh-8.5rem)] gap-3">
        <section className="flex w-2/5 min-w-[360px] flex-col gap-3 overflow-y-auto rounded border border-slate-200 bg-white p-4">
          {session.user.role === 'is_member' && (
            <div className="rounded border border-slate-200 p-3">
              <h2 className="text-sm font-semibold text-slate-700">自分への配布リスト</h2>
              {isLoadingAssignedLists ? (
                <p className="mt-2 text-xs text-slate-500">配布リストを読み込み中...</p>
              ) : assignedListsForMe.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">配布リストはありません。</p>
              ) : (
                <>
                  <select
                    className="mt-2 w-full rounded border border-slate-300 px-2 py-2 text-sm"
                    value={selectedAssignedListId}
                    onChange={handleAssignedListChange}
                  >
                    {assignedListsForMe.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}（{list.itemCount}件）
                      </option>
                    ))}
                  </select>
                  {selectedAssignedListId &&
                    (() => {
                      const selectedList = assignedListsForMe.find((list) => list.id === selectedAssignedListId);
                      if (!selectedList) {
                        return null;
                      }
                      return (
                        <p className="mt-1 text-xs text-slate-500">
                          配布者: {selectedList.assignedBy ?? '-'} / 配布日時:{' '}
                          {selectedList.assignedAt
                            ? new Date(selectedList.assignedAt).toLocaleString('ja-JP')
                            : '-'}
                        </p>
                      );
                    })()}
                </>
              )}
            </div>
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
            <h2 className="text-sm font-semibold text-slate-700">人間承認フロー</h2>
            <p className="mt-1 text-xs text-slate-500">
              {humanApprovalEnabled
                ? 'HPを目視確認後に承認してください。承認前は発信できません。'
                : '設定により承認フローはOFFです（developerテスト設定）。'}
            </p>
            <button
              type="button"
              disabled={!humanApprovalEnabled}
              className="mt-3 w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              onClick={() => {
                void handleApprove();
              }}
            >
              ✅ 内容確認・承認
            </button>
            <p className="mt-2 text-xs text-slate-600">
              {isApproved && approvedAt
                ? `承認日時: ${new Date(approvedAt).toLocaleString('ja-JP')}`
                : humanApprovalEnabled
                  ? '未承認'
                  : '承認不要（OFF）'}
            </p>
          </div>

          <div className="rounded border border-slate-200 p-3">
            <button
              type="button"
              disabled={humanApprovalEnabled ? !isApproved || !approvalId : false}
              className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              onClick={() => {
                void handleDial();
              }}
            >
              📞 ZOOM発信
            </button>
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
                    onChange={() => setSelectedResult(option)}
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
              onChange={(event) => setMemo(event.target.value)}
              className="mt-1 h-20 w-full rounded border border-slate-300 p-2 text-sm"
              placeholder="ヒアリング内容を記録"
            />
            <label htmlFor="next-call" className="mt-3 block text-sm font-medium">
              次回架電
            </label>
            <input
              id="next-call"
              type="datetime-local"
              value={nextCallAt}
              onChange={(event) => setNextCallAt(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
            />
          </div>

          <div className="rounded border border-slate-200 p-3">
            <button
              type="button"
              className="w-full rounded bg-rose-600 px-3 py-2 text-sm font-medium text-white"
              onClick={() => {
                void handleHelpRequest();
              }}
            >
              🆘 ディレクター呼出
            </button>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                onClick={handleSaveRecord}
                disabled={isSaving}
              >
                {isSaving ? '保存中...' : '上書き保存'}
              </button>
              <button
                type="button"
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                onClick={handleNextCompany}
              >
                次へ
              </button>
            </div>
          </div>

          <div className="rounded border border-slate-200 p-3">
            <h2 className="text-sm font-semibold text-slate-700">BGM</h2>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs"
                onClick={() => setIsMuted((prev) => !prev)}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="w-full"
              />
              <span className="w-10 text-right text-xs">{Math.round(volume * 100)}%</span>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs"
                onClick={handleStartBgm}
              >
                再生
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs"
                onClick={handleStopBgm}
              >
                停止
              </button>
            </div>
          </div>
        </section>

        <section className="w-3/5 min-w-[520px] rounded border border-slate-200 bg-white p-2">
          <Group
            orientation="vertical"
            defaultLayout={rightPanelLayout}
            onLayoutChanged={handleRightPanelLayoutChange}
          >
            <Panel id="hp-panel" defaultSize={70} minSize={40}>
              <div className="flex h-full flex-col rounded border border-slate-200">
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
                <iframe
                  title="企業HP"
                  src={displayUrl}
                  className="h-full w-full"
                  onLoad={() => {
                    setIframeLoaded(true);
                    setStatusMessage('企業HPを表示しました。');
                  }}
                />
              </div>
            </Panel>

            <Separator className="my-1 h-3 rounded bg-slate-300" />

            <Panel id="script-panel" defaultSize={30} minSize={20}>
              <div className="flex h-full flex-col rounded border border-slate-200">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`rounded px-2 py-1 text-xs ${
                        activeTabId === tab.id
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-300 text-slate-700'
                      }`}
                      onClick={() => setActiveTabId(tab.id)}
                    >
                      {tab.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="rounded border border-dashed border-slate-400 px-2 py-1 text-xs"
                    onClick={handleAddCustomTab}
                  >
                    + タブ追加
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  {activeTab.isCustom ? (
                    <div className="space-y-2">
                      <input
                        value={activeTab.name}
                        onChange={(event) => handleRenameCustomTab(activeTab.id, event.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        placeholder="タブ名"
                      />
                      <textarea
                        value={activeTab.content}
                        onChange={(event) =>
                          handleTabContentChange(activeTab.id, event.target.value)
                        }
                        className="h-36 w-full rounded border border-slate-300 p-2 text-sm"
                        placeholder="自由書式のトークを入力"
                      />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {activeTab.content}
                    </p>
                  )}
                </div>
              </div>
            </Panel>
          </Group>
        </section>
      </div>

      <p className="mt-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
        ステータス: {statusMessage}
      </p>
    </main>
  );
};

export default CallingPage;
