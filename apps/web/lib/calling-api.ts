import {
  AiScorecardEntry,
  CallingList,
  CallingSettings,
  ListReviewCompletion,
  CallingHelpRequest,
  CallingRecord,
  CallingSummary,
  DialValidationResult,
  ImportListResult,
  ListIndustryMasterRow,
  ListItem,
  ReportByMember,
  ReportPeriod,
  ReportSummary,
  SaveCallingRecordInput,
  ListItemStatus,
  ScriptTab,
  ScriptTemplate,
  ZoomDialSession,
  ZoomCallLog,
  CompanyDetailResponse,
  UpdateCompanyInput,
  UpdateCompanyResult,
} from './types';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? 'http://localhost:3001';

const createAuthHeaders = (accessToken: string): HeadersInit => {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
};

export const getApiBaseUrl = (): string => {
  return apiBaseUrl;
};

export const fetchCompany = async (accessToken: string, legalEntityId: string): Promise<CompanyDetailResponse> => {
  const response = await fetch(`${apiBaseUrl}/companies/${legalEntityId}`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('企業情報の取得に失敗しました')
  }

  return (await response.json()) as CompanyDetailResponse
}

export const updateCompany = async (
  accessToken: string,
  legalEntityId: string,
  input: UpdateCompanyInput,
): Promise<UpdateCompanyResult> => {
  const response = await fetch(`${apiBaseUrl}/companies/${legalEntityId}`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(input),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('企業情報の保存に失敗しました')
  }

  return (await response.json()) as UpdateCompanyResult
}

export const restoreLatestCompanySnapshot = async (
  accessToken: string,
  legalEntityId: string,
): Promise<UpdateCompanyResult> => {
  const response = await fetch(`${apiBaseUrl}/companies/${legalEntityId}/restore-latest`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('企業情報の復元に失敗しました')
  }

  return (await response.json()) as UpdateCompanyResult
}

export const saveCallingRecord = async (
  accessToken: string,
  input: SaveCallingRecordInput,
): Promise<CallingRecord> => {
  const response = await fetch(`${apiBaseUrl}/calling/records`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('架電記録の保存に失敗しました');
  }

  return (await response.json()) as CallingRecord;
};

export const fetchCallingSummary = async (accessToken: string): Promise<CallingSummary> => {
  const response = await fetch(`${apiBaseUrl}/calling/summary`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('架電サマリーの取得に失敗しました');
  }

  return (await response.json()) as CallingSummary;
};

export const fetchRecallList = async (accessToken: string): Promise<CallingRecord[]> => {
  const response = await fetch(`${apiBaseUrl}/calling/recall`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('再架電一覧の取得に失敗しました');
  }

  return (await response.json()) as CallingRecord[];
};

export const createListReviewCompletion = async (
  accessToken: string,
  input: { companyName: string; targetUrl: string },
): Promise<ListReviewCompletion> => {
  const response = await fetch(`${apiBaseUrl}/calling/list-review-completions`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('リスト精査終了の保存に失敗しました');
  }

  return (await response.json()) as ListReviewCompletion;
};

export const validateDialPermission = async (
  accessToken: string,
  input: { listReviewCompletionId: string; targetUrl: string },
): Promise<DialValidationResult> => {
  const response = await fetch(`${apiBaseUrl}/calling/dial-check`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('発信可否の確認に失敗しました');
  }

  return (await response.json()) as DialValidationResult;
};

export const createHelpRequest = async (
  accessToken: string,
  input: { companyName: string; scriptTab: string },
): Promise<CallingHelpRequest> => {
  const response = await fetch(`${apiBaseUrl}/calling/help-requests`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('ディレクター呼出の送信に失敗しました');
  }

  return (await response.json()) as CallingHelpRequest;
};

export const fetchRecentHelpRequests = async (accessToken: string): Promise<CallingHelpRequest[]> => {
  const response = await fetch(`${apiBaseUrl}/calling/help-requests/recent`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('呼出履歴の取得に失敗しました');
  }

  return (await response.json()) as CallingHelpRequest[];
};

export const joinHelpRequest = async (
  accessToken: string,
  requestId: string,
): Promise<CallingHelpRequest> => {
  const response = await fetch(`${apiBaseUrl}/calling/help-requests/${requestId}/join`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('ディレクター参加処理に失敗しました');
  }

  return (await response.json()) as CallingHelpRequest;
};

export const closeHelpRequest = async (
  accessToken: string,
  requestId: string,
): Promise<CallingHelpRequest> => {
  const response = await fetch(`${apiBaseUrl}/calling/help-requests/${requestId}/close`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('呼出対応完了処理に失敗しました');
  }

  return (await response.json()) as CallingHelpRequest;
};

export const sendDirectorWhisper = async (
  accessToken: string,
  requestId: string,
  message: string,
): Promise<{ ok: true }> => {
  const response = await fetch(`${apiBaseUrl}/director/whisper`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify({ requestId, message }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('囁きの送信に失敗しました');
  }

  return (await response.json()) as { ok: true };
};

export const importCsvList = async (
  accessToken: string,
  input: { csvText: string; name?: string },
): Promise<ImportListResult> => {
  const response = await fetch(`${apiBaseUrl}/lists/import-csv`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('CSVインポートに失敗しました');
  }

  return (await response.json()) as ImportListResult;
};

export const fetchCallingLists = async (accessToken: string): Promise<CallingList[]> => {
  const response = await fetch(`${apiBaseUrl}/lists`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('リスト一覧の取得に失敗しました');
  }

  return (await response.json()) as CallingList[];
};

export type UserListItem = {
  id: string;
  email: string;
  name: string;
  role: string;
  roles?: string[];
  profileImageUrl: string | null;
  countryCode: string | null;
  prefecture: string | null;
  mobilePhone: string | null;
  createdAt: string;
  /** テナント既定PJ（1テナント1件）への配役。API が project_memberships と同期して返す */
  projectAssignment?: {
    projectId: string;
    projectName: string;
    pjRole: 'director' | 'is_member';
  } | null;
};

export const fetchUsers = async (accessToken: string): Promise<UserListItem[]> => {
  const response = await fetch(`${apiBaseUrl}/users`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    let detail = '';
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      if (typeof j.message === 'string') {
        detail = j.message;
      } else if (Array.isArray(j.message)) {
        detail = j.message.join('; ');
      }
    } catch {
      if (text.trim().length > 0) {
        detail = text.trim().slice(0, 240);
      }
    }
    throw new Error(
      detail.length > 0
        ? `ユーザー一覧の取得に失敗しました: ${detail}`
        : 'ユーザー一覧の取得に失敗しました',
    );
  }

  return (await response.json()) as UserListItem[];
};

/** 管理画面 BOX: director（Tier1）/ is（Tier2）に応じて director・is_member を切替 */
export const assignUserTierBox = async (
  accessToken: string,
  userId: string,
  box: 'director' | 'is',
): Promise<UserListItem> => {
  const response = await fetch(`${apiBaseUrl}/users/${encodeURIComponent(userId)}/tier`, {
    method: 'PATCH',
    headers: {
      ...createAuthHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ box }),
    cache: 'no-store',
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || 'ロールの更新に失敗しました');
  }
  return (await response.json()) as UserListItem;
};

/** 既定PJから除名（director / is_member を外し project_memberships を削除） */
export const removeUserFromPj = async (
  accessToken: string,
  userId: string,
): Promise<UserListItem> => {
  const response = await fetch(`${apiBaseUrl}/users/${encodeURIComponent(userId)}/pj-membership`, {
    method: 'DELETE',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || 'PJからの除名に失敗しました');
  }
  return (await response.json()) as UserListItem;
};

export const fetchAssignedCallingLists = async (accessToken: string): Promise<CallingList[]> => {
  const response = await fetch(`${apiBaseUrl}/lists/assigned/me`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('配布リストの取得に失敗しました');
  }

  return (await response.json()) as CallingList[];
};

export const fetchListItems = async (accessToken: string, listId: string): Promise<ListItem[]> => {
  const response = await fetch(`${apiBaseUrl}/lists/${listId}/items`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('リスト明細の取得に失敗しました');
  }

  return (await response.json()) as ListItem[];
};

export type DistributeListFilters = {
  addressContains?: string
  cityContains?: string
  industryTagContains?: string
  callProgress?: 'unstarted' | 'contacted' | 'any'
  aiTiers?: ('A' | 'B' | 'C')[]
}

const appendDistributeFilterParams = (params: URLSearchParams, filters: DistributeListFilters): void => {
  const addr = filters.addressContains?.trim()
  const city = filters.cityContains?.trim()
  const tag = filters.industryTagContains?.trim()
  if (addr) params.set('addressContains', addr)
  if (city) params.set('cityContains', city)
  if (tag) params.set('industryTagContains', tag)
  if (filters.callProgress) params.set('callProgress', filters.callProgress)
  for (const t of filters.aiTiers ?? []) {
    params.append('aiTiers', t)
  }
}

const distributeFilterBody = (
  assigneeUserIds: string[],
  filters: DistributeListFilters,
): Record<string, unknown> => {
  const body: Record<string, unknown> = { assigneeUserIds }
  const addr = filters.addressContains?.trim()
  const city = filters.cityContains?.trim()
  const tag = filters.industryTagContains?.trim()
  if (addr) body.addressContains = addr
  if (city) body.cityContains = city
  if (tag) body.industryTagContains = tag
  if (filters.callProgress) body.callProgress = filters.callProgress
  if (filters.aiTiers && filters.aiTiers.length > 0) body.aiTiers = filters.aiTiers
  return body
}

export const fetchListIndustryMasters = async (
  accessToken: string,
): Promise<ListIndustryMasterRow[]> => {
  const response = await fetch(`${apiBaseUrl}/lists/masters/industries`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('業種マスタの取得に失敗しました')
  }

  return (await response.json()) as ListIndustryMasterRow[]
}

export const previewDistributeEvenMatch = async (
  accessToken: string,
  listId: string,
  filters: DistributeListFilters,
): Promise<{ matchCount: number }> => {
  const params = new URLSearchParams()
  appendDistributeFilterParams(params, filters)
  const qs = params.toString()
  const url = `${apiBaseUrl}/lists/${listId}/items/distribute-even/preview${qs ? `?${qs}` : ''}`
  const response = await fetch(url, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('配布対象件数の取得に失敗しました')
  }

  return (await response.json()) as { matchCount: number }
}

export const distributeListItemsEven = async (
  accessToken: string,
  listId: string,
  input: { assigneeUserIds: string[] } & DistributeListFilters,
): Promise<{ updatedCount: number }> => {
  const { assigneeUserIds, ...filters } = input
  const response = await fetch(`${apiBaseUrl}/lists/${listId}/items/distribute-even`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(distributeFilterBody(assigneeUserIds, filters)),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('配布に失敗しました')
  }

  return (await response.json()) as { updatedCount: number }
}

export const recallListItems = async (
  accessToken: string,
  listId: string,
  input: { assigneeUserId?: string; mode?: 'all' | 'unstartedOnly' | 'callingOnly' },
): Promise<{ updatedCount: number }> => {
  const response = await fetch(`${apiBaseUrl}/lists/${listId}/items/recall`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(input),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('引き上げに失敗しました')
  }

  return (await response.json()) as { updatedCount: number }
}

export const updateListItemStatus = async (
  accessToken: string,
  itemId: string,
  status: ListItemStatus,
): Promise<ListItem> => {
  const response = await fetch(`${apiBaseUrl}/lists/items/${itemId}/status`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify({ status }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('ステータス更新に失敗しました')
  }

  return (await response.json()) as ListItem
}

export const fetchListKpiByAssignee = async (
  accessToken: string,
  listId: string,
): Promise<{ assigneeUserId: string | null; status: string; count: number }[]> => {
  const response = await fetch(`${apiBaseUrl}/lists/${listId}/kpi/by-assignee`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('KPIの取得に失敗しました')
  }

  return (await response.json()) as { assigneeUserId: string | null; status: string; count: number }[]
}

export const assignCallingList = async (
  accessToken: string,
  listId: string,
  input: { assigneeEmail: string },
): Promise<CallingList> => {
  const response = await fetch(`${apiBaseUrl}/lists/${listId}/assign`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('リスト配布に失敗しました');
  }

  return (await response.json()) as CallingList;
};

export const unassignCallingList = async (
  accessToken: string,
  listId: string,
): Promise<CallingList> => {
  const response = await fetch(`${apiBaseUrl}/lists/${listId}/unassign`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('リスト配布解除に失敗しました');
  }

  return (await response.json()) as CallingList;
};

// -----------------------------
// リスト生成（マスタ・生成・履歴・アドバイス）
// -----------------------------

export const fetchListAreaMasters = async (accessToken: string) => {
  const response = await fetch(`${apiBaseUrl}/lists/masters/areas`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('エリアマスタの取得に失敗しました');
  return (await response.json()) as { id: string; name: string; isActive: boolean }[];
};

export const fetchListKeywordMasters = async (accessToken: string) => {
  const response = await fetch(`${apiBaseUrl}/lists/masters/keywords`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('キーワードマスタの取得に失敗しました');
  return (await response.json()) as { id: string; name: string; isActive: boolean }[];
};

export const createListAreaMaster = async (
  accessToken: string,
  name: string,
): Promise<{ id: string; name: string; isActive: boolean }> => {
  const response = await fetch(`${apiBaseUrl}/lists/masters/areas`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify({ name }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('エリアマスタの作成に失敗しました');
  return (await response.json()) as { id: string; name: string; isActive: boolean };
};

export const createListIndustryMaster = async (
  accessToken: string,
  name: string,
): Promise<{ id: string; name: string; isActive: boolean }> => {
  const response = await fetch(`${apiBaseUrl}/lists/masters/industries`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify({ name }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('業種マスタの作成に失敗しました');
  return (await response.json()) as { id: string; name: string; isActive: boolean };
};

export const createListKeywordMaster = async (
  accessToken: string,
  name: string,
): Promise<{ id: string; name: string; isActive: boolean }> => {
  const response = await fetch(`${apiBaseUrl}/lists/masters/keywords`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify({ name }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('キーワードマスタの作成に失敗しました');
  return (await response.json()) as { id: string; name: string; isActive: boolean };
};

export const generateList = async (
  accessToken: string,
  input: { input: { areaId: string; industryId: string; keywordIds: string[]; limit?: number }; assigneeEmail: string; listName?: string },
): Promise<{ requestId: string; status: string }> => {
  const response = await fetch(`${apiBaseUrl}/lists/generate`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('リスト生成リクエストに失敗しました');
  return (await response.json()) as { requestId: string; status: string };
};

export const fetchGenerationRequests = async (accessToken: string) => {
  const response = await fetch(`${apiBaseUrl}/lists/generation-requests`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('生成履歴の取得に失敗しました');
  return (await response.json()) as {
    id: string;
    status: string;
    assignedToEmail: string;
    resultListId: string | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
    input: unknown;
  }[];
};

export const fetchListAdvice = async (
  accessToken: string,
  question: string,
): Promise<{ advice: string; suggestedActions: { type: string; title: string; payload: Record<string, unknown> }[] }> => {
  const response = await fetch(`${apiBaseUrl}/lists/advice`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify({ question }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('AIアドバイスの取得に失敗しました');
  return (await response.json()) as { advice: string; suggestedActions: { type: string; title: string; payload: Record<string, unknown> }[] };
};

export const fetchRecentZoomCalls = async (accessToken: string): Promise<ZoomCallLog[]> => {
  const response = await fetch(`${apiBaseUrl}/zoom/calls`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('ZOOM通話ログの取得に失敗しました');
  }

  return (await response.json()) as ZoomCallLog[];
};

export const createZoomDialSession = async (
  accessToken: string,
  input: { companyName: string; targetUrl: string },
): Promise<ZoomDialSession> => {
  const response = await fetch(`${apiBaseUrl}/zoom/dial-session`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('ZOOM発信セッションの作成に失敗しました');
  }

  return (await response.json()) as ZoomDialSession;
};

export const fetchReportSummary = async (
  accessToken: string,
  period: ReportPeriod,
): Promise<ReportSummary> => {
  const query = new URLSearchParams({ period }).toString();
  const response = await fetch(`${apiBaseUrl}/reports/summary?${query}`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('レポート集計の取得に失敗しました');
  }

  return (await response.json()) as ReportSummary;
};

export const fetchReportByMember = async (
  accessToken: string,
  period: ReportPeriod,
): Promise<ReportByMember> => {
  const query = new URLSearchParams({ period }).toString();
  const response = await fetch(`${apiBaseUrl}/reports/by-member?${query}`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('IS別実績の取得に失敗しました');
  }

  return (await response.json()) as ReportByMember;
};

/**
 * AIスコアカード一覧取得（ダミー実装）。
 * 後から実装する場合: GET ${apiBaseUrl}/reports/ai-scorecard を呼んで JSON を返す。
 */
export const fetchReportAiScorecard = async (_accessToken: string): Promise<AiScorecardEntry[]> => {
  return [];
};

export const fetchCallingSettings = async (accessToken: string): Promise<CallingSettings> => {
  const response = await fetch(`${apiBaseUrl}/settings/calling`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('架電設定の取得に失敗しました');
  }

  return (await response.json()) as CallingSettings;
};

export const updateCallingSettings = async (
  accessToken: string,
  input: { humanApprovalEnabled: boolean },
): Promise<CallingSettings> => {
  const response = await fetch(`${apiBaseUrl}/settings/calling`, {
    method: 'PATCH',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('架電設定の更新に失敗しました');
  }

  return (await response.json()) as CallingSettings;
};

export const fetchScriptTemplates = async (accessToken: string): Promise<ScriptTemplate[]> => {
  const response = await fetch(`${apiBaseUrl}/scripts`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('スクリプト一覧の取得に失敗しました');
  }

  return (await response.json()) as ScriptTemplate[];
};

export const createScriptTemplate = async (
  accessToken: string,
  input: { name: string; industryTag?: string; tabs: ScriptTab[] },
): Promise<ScriptTemplate> => {
  const response = await fetch(`${apiBaseUrl}/scripts`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('スクリプト作成に失敗しました');
  }

  return (await response.json()) as ScriptTemplate;
};

export const updateScriptTemplate = async (
  accessToken: string,
  templateId: string,
  input: { name: string; industryTag?: string; tabs: ScriptTab[] },
): Promise<ScriptTemplate> => {
  const response = await fetch(`${apiBaseUrl}/scripts/${templateId}`, {
    method: 'PATCH',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('スクリプト更新に失敗しました');
  }

  return (await response.json()) as ScriptTemplate;
};

export const deleteScriptTemplate = async (
  accessToken: string,
  templateId: string,
): Promise<void> => {
  const response = await fetch(`${apiBaseUrl}/scripts/${templateId}`, {
    method: 'DELETE',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('スクリプト削除に失敗しました');
  }
};

