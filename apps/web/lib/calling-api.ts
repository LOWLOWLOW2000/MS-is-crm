import {
  AiScorecardEntry,
  CallingList,
  CallingSettings,
  TalkScriptDraftDetail,
  TalkScriptDraftSummary,
  TalkScriptPublishedDetail,
  TalkScriptPublishedSummary,
  TalkScriptType,
  ListReviewCompletion,
  CallingHelpRequest,
  CallingRecord,
  CallingSummary,
  DialValidationResult,
  ImportListResult,
  ListIndustryMasterRow,
  ListItem,
  KpiTimeseries,
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
  DirectorRequestRow,
  DirectorRequestSummary,
  MyAppointmentMaterialSummary,
  ReportingFormatDefinitionRow,
  KpiGoal,
  KpiGoalMatrix,
  KpiGoalScope,
  KpiGoalValues,
  TenantProfile,
  UpdateTenantBody,
} from './types';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? 'http://localhost:3001';

const createAuthHeaders = (accessToken: string): HeadersInit => {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
};

/** Nest の { message: string | string[] } を人が読める1行にする */
const readApiErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const data = (await response.json()) as { message?: string | string[] }
    if (Array.isArray(data.message)) {
      return data.message.join(' ')
    }
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message
    }
  } catch {
    // body が JSON でない場合はフォールバック
  }
  return fallback
}

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

export const fetchMyCompany = async (accessToken: string): Promise<CompanyDetailResponse> => {
  const response = await fetch(`${apiBaseUrl}/companies/me`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await readApiErrorMessage(response, '企業情報の取得に失敗しました')
    throw new Error(message)
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
    const message = await readApiErrorMessage(response, '架電記録の保存に失敗しました')
    throw new Error(message)
  }

  return (await response.json()) as CallingRecord
}

/**
 * テナントの報告フォーマット定義（未作成テナントは API 側で既定行を生成）
 */
export const fetchReportingFormats = async (
  accessToken: string,
): Promise<ReportingFormatDefinitionRow[]> => {
  const response = await fetch(`${apiBaseUrl}/calling/reporting-formats`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  })
  if (!response.ok) {
    const message = await readApiErrorMessage(response, '報告フォーマットの取得に失敗しました')
    throw new Error(message)
  }
  return (await response.json()) as ReportingFormatDefinitionRow[]
}

/**
 * 報告フォーマット定義の更新（ディレクター／管理者）
 */
export const upsertReportingFormat = async (
  accessToken: string,
  kind: string,
  schemaJson: Record<string, unknown>,
): Promise<ReportingFormatDefinitionRow> => {
  const response = await fetch(`${apiBaseUrl}/calling/reporting-formats/${encodeURIComponent(kind)}`, {
    method: 'PUT',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify({ schemaJson }),
    cache: 'no-store',
  })
  if (!response.ok) {
    const message = await readApiErrorMessage(response, '報告フォーマットの保存に失敗しました')
    throw new Error(message)
  }
  return (await response.json()) as ReportingFormatDefinitionRow
}

export interface ListItemDirectorNoteResponse {
  listItemId: string
  bodyMarkdown: string
  updatedAt: string
}

export const fetchListItemDirectorNote = async (
  accessToken: string,
  listItemId: string,
): Promise<ListItemDirectorNoteResponse> => {
  const response = await fetch(
    `${apiBaseUrl}/calling/list-items/${encodeURIComponent(listItemId)}/director-note`,
    {
      method: 'GET',
      headers: createAuthHeaders(accessToken),
      cache: 'no-store',
    },
  )
  if (!response.ok) {
    const message = await readApiErrorMessage(response, 'ディレクターノートの取得に失敗しました')
    throw new Error(message)
  }
  return (await response.json()) as ListItemDirectorNoteResponse
}

export interface CallingRecordsExportOptions {
  format: 'csv' | 'xlsx'
  scope?: 'self' | 'tenant'
  from?: string
  to?: string
}

/**
 * 架電記録を CSV / Excel でダウンロード（ブラウザが Blob を保存）
 */
export const downloadCallingRecordsExport = async (
  accessToken: string,
  opts: CallingRecordsExportOptions,
): Promise<void> => {
  const params = new URLSearchParams()
  params.set('format', opts.format)
  params.set('scope', opts.scope ?? 'self')
  const from = opts.from?.trim()
  const to = opts.to?.trim()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const response = await fetch(`${apiBaseUrl}/calling/records/export?${params}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!response.ok) {
    const message = await readApiErrorMessage(response, 'エクスポートに失敗しました')
    throw new Error(message)
  }
  const blob = await response.blob()
  let filename = opts.format === 'xlsx' ? 'calling-records.xlsx' : 'calling-records.csv'
  const cd = response.headers.get('Content-Disposition')
  const m = cd?.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i)
  const rawName = m?.[1] ?? m?.[2]
  if (rawName) {
    try {
      filename = decodeURIComponent(rawName.replace(/"/g, ''))
    } catch {
      filename = rawName.replace(/"/g, '')
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

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

export const fetchDirectorRequestsSummary = async (accessToken: string): Promise<DirectorRequestSummary> => {
  const response = await fetch(`${apiBaseUrl}/director/requests/summary`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await readApiErrorMessage(response, 'アポ・資料請求サマリの取得に失敗しました')
    throw new Error(message)
  }

  return (await response.json()) as DirectorRequestSummary
}

export const fetchDirectorRequests = async (accessToken: string): Promise<DirectorRequestRow[]> => {
  const response = await fetch(`${apiBaseUrl}/director/requests`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await readApiErrorMessage(response, 'アポ・資料請求一覧の取得に失敗しました')
    throw new Error(message)
  }

  return (await response.json()) as DirectorRequestRow[]
}

export const markDirectorRequestsAsRead = async (
  accessToken: string,
  body: { ids?: string[]; markAll?: boolean },
): Promise<{ updated: number }> => {
  const response = await fetch(`${apiBaseUrl}/director/requests/read`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await readApiErrorMessage(response, 'アポ・資料請求の既読化に失敗しました')
    throw new Error(message)
  }

  return (await response.json()) as { updated: number }
}

export const fetchMyAppointmentMaterialSummary = async (
  accessToken: string,
): Promise<MyAppointmentMaterialSummary> => {
  const response = await fetch(`${apiBaseUrl}/calling/my-appointment-material/summary`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await readApiErrorMessage(response, 'アポ・資料サマリの取得に失敗しました')
    throw new Error(message)
  }

  return (await response.json()) as MyAppointmentMaterialSummary
}

export const fetchMyAppointmentMaterial = async (
  accessToken: string,
  type?: 'appointment' | 'material',
): Promise<DirectorRequestRow[]> => {
  const qs = type ? `?type=${encodeURIComponent(type)}` : ''
  const response = await fetch(`${apiBaseUrl}/calling/my-appointment-material${qs}`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await readApiErrorMessage(response, 'アポ・資料一覧の取得に失敗しました')
    throw new Error(message)
  }

  return (await response.json()) as DirectorRequestRow[]
}

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
    throw new Error(await readApiErrorMessage(response, 'CSVインポートに失敗しました'))
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
  slackId: string | null;
  departmentName: string | null;
  createdAt: string;
  /** テナント既定PJ（1テナント1件）への配役。API が project_memberships と同期して返す */
  projectAssignment?: {
    projectId: string;
    projectName: string;
    pjRole: 'director' | 'is_member';
  } | null;
};

export type MyProfile = {
  id: string
  tenantId: string
  email: string
  name: string
  profileImageUrl: string | null
  role: string
  roles: string[]
  countryCode: string | null
  prefecture: string | null
  mobilePhone: string | null
  slackId: string | null
  departmentName: string | null
  /** メール+パスワードでログイン可能か */
  hasPassword: boolean
  /** テナント表示（ヘッダーと同系） */
  tenantCompanyName: string
  tenantProjectName: string
  /** 既定PJへの配役（未参加なら null） */
  projectAssignment?: UserListItem['projectAssignment']
};

export type UpdateMyProfileBody = {
  name?: string
  countryCode?: string | null
  prefecture?: string | null
  mobilePhone?: string | null
  slackId?: string | null
  departmentName?: string | null
}

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

/** テナント（企業アカウント）プロフィール */
export const fetchTenantProfile = async (accessToken: string): Promise<TenantProfile> => {
  const response = await fetch(`${apiBaseUrl}/tenants/me`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error('企業アカウント情報の取得に失敗しました')
  }
  return (await response.json()) as TenantProfile
}

/** 企業管理者: テナントプロフィール・AM 割当の更新 */
export const updateTenantProfile = async (
  accessToken: string,
  body: UpdateTenantBody,
): Promise<TenantProfile> => {
  const response = await fetch(`${apiBaseUrl}/tenants/me`, {
    method: 'PATCH',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!response.ok) {
    const msg = await readApiErrorMessage(response, '企業アカウント情報の保存に失敗しました')
    throw new Error(msg)
  }
  return (await response.json()) as TenantProfile
}

/** 自分自身のプロフィール取得（プロフ写真など） */
export const fetchMyProfile = async (accessToken: string): Promise<MyProfile> => {
  const response = await fetch(`${apiBaseUrl}/users/me`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'プロフィール取得に失敗しました')
  }
  return (await response.json()) as MyProfile
}

/** 自分自身のプロフィール更新（住所・電話・Slack・表示名） */
export const updateMyProfile = async (
  accessToken: string,
  body: UpdateMyProfileBody,
): Promise<MyProfile> => {
  const response = await fetch(`${apiBaseUrl}/users/me`, {
    method: 'PATCH',
    headers: {
      ...createAuthHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const errText = await response.text()
    let detail = errText
    try {
      const j = JSON.parse(errText) as { message?: string | string[] }
      if (typeof j.message === 'string') detail = j.message
      else if (Array.isArray(j.message)) detail = j.message.join('; ')
    } catch {
      if (errText.trim().length > 0) detail = errText.trim().slice(0, 400)
    }
    throw new Error(detail || 'プロフィール更新に失敗しました')
  }
  return (await response.json()) as MyProfile
}

/** メール+パスワード利用者向けパスワード変更（成功後は refresh が失効） */
export const changePassword = async (
  accessToken: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true }> => {
  const response = await fetch(`${apiBaseUrl}/auth/change-password`, {
    method: 'POST',
    headers: {
      ...createAuthHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  if (!response.ok) {
    const errText = await response.text()
    let detail = errText
    try {
      const j = JSON.parse(errText) as { message?: string | string[] }
      if (typeof j.message === 'string') detail = j.message
      else if (Array.isArray(j.message)) detail = j.message.join('; ')
    } catch {
      /* テキストのまま */
    }
    throw new Error(detail || 'パスワード変更に失敗しました')
  }
  return (await response.json()) as { ok: true }
}

/** 自分自身のプロフ写真更新（MVP: dataURL文字列を保存） */
export const updateMyProfileImage = async (
  accessToken: string,
  profileImageUrl: string,
): Promise<{ profileImageUrl: string | null }> => {
  const response = await fetch(`${apiBaseUrl}/users/me/profile-image`, {
    method: 'PATCH',
    headers: {
      ...createAuthHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ profileImageUrl }),
  })
  if (!response.ok) {
    const errText = await response.text()
    throw new Error(errText || 'プロフ写真更新に失敗しました')
  }
  return (await response.json()) as { profileImageUrl: string | null }
}

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

/** 既定PJからサインアウト（project_memberships のみ削除） */
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

export const fetchListItemById = async (accessToken: string, itemId: string): Promise<ListItem> => {
  const response = await fetch(`${apiBaseUrl}/lists/items/${itemId}`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('リスト明細の取得に失敗しました')
  }

  return (await response.json()) as ListItem
};

export type DistributeListFilters = {
  addressContains?: string
  cityContains?: string
  industryTagContains?: string
  /** 業種マスタ名の複数（いずれかに industryTag が部分一致） */
  industryNames?: string[]
  callProgress?: 'unstarted' | 'contacted' | 'any'
  statuses?: string[]
  aiTiers?: ('A' | 'B' | 'C')[]
}

const appendDistributeFilterParams = (params: URLSearchParams, filters: DistributeListFilters): void => {
  const addr = filters.addressContains?.trim()
  const city = filters.cityContains?.trim()
  const tag = filters.industryTagContains?.trim()
  if (addr) params.set('addressContains', addr)
  if (city) params.set('cityContains', city)
  if (tag) params.set('industryTagContains', tag)
  for (const n of filters.industryNames ?? []) {
    const t = n.trim()
    if (t.length > 0) params.append('industryNames', t)
  }
  if (filters.callProgress) params.set('callProgress', filters.callProgress)
  for (const s of filters.statuses ?? []) {
    const t = s.trim()
    if (t.length > 0) params.append('statuses', t)
  }
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
  if (filters.industryNames && filters.industryNames.length > 0) body.industryNames = filters.industryNames
  if (filters.callProgress) body.callProgress = filters.callProgress
  if (filters.statuses && filters.statuses.length > 0) body.statuses = filters.statuses
  if (filters.aiTiers && filters.aiTiers.length > 0) body.aiTiers = filters.aiTiers
  return body
}

const distributeTargetFilterBody = (
  assigneeUserIds: string[],
  targetCounts: number[],
  filters: DistributeListFilters,
): Record<string, unknown> => {
  const body: Record<string, unknown> = { assigneeUserIds, targetCounts }
  const addr = filters.addressContains?.trim()
  const city = filters.cityContains?.trim()
  const tag = filters.industryTagContains?.trim()
  if (addr) body.addressContains = addr
  if (city) body.cityContains = city
  if (tag) body.industryTagContains = tag
  if (filters.industryNames && filters.industryNames.length > 0) body.industryNames = filters.industryNames
  if (filters.callProgress) body.callProgress = filters.callProgress
  if (filters.statuses && filters.statuses.length > 0) body.statuses = filters.statuses
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

export const distributeListItemsTargetCounts = async (
  accessToken: string,
  listId: string,
  input: { assigneeUserIds: string[]; targetCounts: number[] } & DistributeListFilters,
): Promise<{ updatedCount: number }> => {
  const { assigneeUserIds, targetCounts, ...filters } = input
  const response = await fetch(`${apiBaseUrl}/lists/${listId}/items/distribute-target`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(distributeTargetFilterBody(assigneeUserIds, targetCounts, filters)),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('目標件数配布に失敗しました')
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
  const response = await fetch(`${apiBaseUrl}/list-generation/areas`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('エリアマスタの取得に失敗しました');
  return (await response.json()) as { id: string; name: string; isActive: boolean }[];
};

export const fetchListKeywordMasters = async (accessToken: string) => {
  const response = await fetch(`${apiBaseUrl}/list-generation/keywords`, {
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
  const response = await fetch(`${apiBaseUrl}/list-generation/areas`, {
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
  const response = await fetch(`${apiBaseUrl}/list-generation/industries`, {
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
  const response = await fetch(`${apiBaseUrl}/list-generation/keywords`, {
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
  const normalizedInput = {
    areaIds: input.input.areaId ? [input.input.areaId] : [],
    industryIds: input.input.industryId ? [input.input.industryId] : [],
    keywordIds: input.input.keywordIds ?? [],
    ...(typeof input.input.limit === 'number' ? { limit: input.input.limit } : {}),
    ...(input.listName ? { listName: input.listName } : {}),
  }
  const response = await fetch(`${apiBaseUrl}/list-generation/requests`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify({
      assignedToEmail: input.assigneeEmail,
      input: normalizedInput,
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('リスト生成リクエストに失敗しました');
  return (await response.json()) as { requestId: string; status: string };
};

export const fetchGenerationRequests = async (accessToken: string) => {
  const response = await fetch(`${apiBaseUrl}/list-generation/requests`, {
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
  const response = await fetch(`${apiBaseUrl}/list-generation/requests`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify({
      assignedToEmail: 'ai-advisor@local',
      input: { freeText: question },
    }),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('AIアドバイスの取得に失敗しました')
  }
  const created = (await response.json()) as { id?: string; status?: string }
  return {
    advice: 'アドバイス依頼を受け付けました。運用フローでは生成リクエスト履歴から進行状況を確認してください。',
    suggestedActions: [
      {
        type: 'open_generation_requests',
        title: '生成リクエスト履歴を開く',
        payload: { requestId: created.id ?? null, status: created.status ?? 'queued' },
      },
    ],
  }
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
  range?: { from?: string; to?: string },
): Promise<ReportByMember> => {
  const params = new URLSearchParams({ period })
  const from = range?.from?.trim()
  const to = range?.to?.trim()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()
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

export const fetchKpiTimeseries = async (
  accessToken: string,
  scope: 'personal' | 'team',
  range?: { from?: string; to?: string },
): Promise<KpiTimeseries> => {
  const params = new URLSearchParams({ scope })
  const from = range?.from?.trim()
  const to = range?.to?.trim()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()
  const response = await fetch(`${apiBaseUrl}/reports/kpi-timeseries?${query}`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error('KPI時系列の取得に失敗しました')
  }
  return (await response.json()) as KpiTimeseries
}

/**
 * AIスコアカード一覧取得。
 * @param accessToken JWTアクセストークン
 */
export const fetchReportAiScorecard = async (accessToken: string): Promise<AiScorecardEntry[]> => {
  const response = await fetch(`${apiBaseUrl}/reports/ai-scorecard`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('AIスコアカードの取得に失敗しました')
  }
  const payload = await response.json()
  if (!Array.isArray(payload)) return []
  return payload
    .filter((row): row is AiScorecardEntry => !!row && typeof row === 'object')
    .sort((a, b) => {
      const bTime = new Date(b.evaluatedAt ?? b.callDate).getTime()
      const aTime = new Date(a.evaluatedAt ?? a.callDate).getTime()
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime)
    })
}

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

/**
 * 架電ルームの「内容確認・承認」を企業アカウント（テナント）単位で1回記録する（冪等）。
 */
export const acknowledgeSalesRoomContent = async (
  accessToken: string,
): Promise<CallingSettings> => {
  const response = await fetch(`${apiBaseUrl}/settings/calling/sales-room-content-ack`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('承認の記録に失敗しました');
  }

  return (await response.json()) as CallingSettings;
};

export const fetchKpiGoalMatrix = async (accessToken: string): Promise<KpiGoalMatrix> => {
  const response = await fetch(`${apiBaseUrl}/kpi-goals/matrix`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error('KPI目標一覧の取得に失敗しました')
  }
  return (await response.json()) as KpiGoalMatrix
}

export const upsertKpiGoal = async (
  accessToken: string,
  input: KpiGoalValues & { scope: KpiGoalScope; targetUserId?: string },
): Promise<KpiGoal> => {
  const response = await fetch(`${apiBaseUrl}/kpi-goals`, {
    method: 'PUT',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(input),
    cache: 'no-store',
  })
  if (!response.ok) {
    const message = await readApiErrorMessage(response, 'KPI目標の保存に失敗しました')
    throw new Error(message)
  }
  return (await response.json()) as KpiGoal
}

export const updateCallingSettings = async (
  accessToken: string,
  input: {
    humanApprovalEnabled?: boolean;
    callProviderKind?: CallingSettings['callProviderKind'];
    callProviderConfig?: Record<string, unknown> | null;
  },
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

export const fetchPublishedTalkScripts = async (
  accessToken: string,
  type: TalkScriptType,
): Promise<TalkScriptPublishedSummary[]> => {
  const q = new URLSearchParams({ type }).toString();
  const response = await fetch(`${apiBaseUrl}/talk-scripts/published?${q}`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('公開トークスクリプト一覧の取得に失敗しました');
  }
  return (await response.json()) as TalkScriptPublishedSummary[];
};

export const fetchPublishedTalkScriptVersion = async (
  accessToken: string,
  versionId: string,
): Promise<TalkScriptPublishedDetail> => {
  const response = await fetch(
    `${apiBaseUrl}/talk-scripts/published/${encodeURIComponent(versionId)}`,
    {
      method: 'GET',
      headers: createAuthHeaders(accessToken),
      cache: 'no-store',
    },
  );
  if (!response.ok) {
    throw new Error('トークスクリプトの取得に失敗しました');
  }
  return (await response.json()) as TalkScriptPublishedDetail;
};

export const fetchTalkScriptDrafts = async (
  accessToken: string,
  type: TalkScriptType,
): Promise<TalkScriptDraftSummary[]> => {
  const q = new URLSearchParams({ type }).toString();
  const response = await fetch(`${apiBaseUrl}/talk-scripts/drafts?${q}`, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('下書き一覧の取得に失敗しました');
  }
  return (await response.json()) as TalkScriptDraftSummary[];
};

export const fetchTalkScriptDraftVersion = async (
  accessToken: string,
  versionId: string,
): Promise<TalkScriptDraftDetail> => {
  const response = await fetch(
    `${apiBaseUrl}/talk-scripts/drafts/${encodeURIComponent(versionId)}`,
    {
      method: 'GET',
      headers: createAuthHeaders(accessToken),
      cache: 'no-store',
    },
  );
  if (!response.ok) {
    throw new Error('下書きの取得に失敗しました');
  }
  return (await response.json()) as TalkScriptDraftDetail;
};

export const createTalkScriptVersion = async (
  accessToken: string,
  input: { type: TalkScriptType; label: string; content: Record<string, unknown> },
): Promise<{ id: string }> => {
  const response = await fetch(`${apiBaseUrl}/talk-scripts/versions`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('トークスクリプト下書きの作成に失敗しました');
  }
  return (await response.json()) as { id: string };
};

export const updateTalkScriptVersion = async (
  accessToken: string,
  versionId: string,
  input: { label?: string; content?: Record<string, unknown> },
): Promise<void> => {
  const response = await fetch(
    `${apiBaseUrl}/talk-scripts/versions/${encodeURIComponent(versionId)}`,
    {
      method: 'PATCH',
      headers: createAuthHeaders(accessToken),
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
  if (!response.ok) {
    throw new Error('トークスクリプトの更新に失敗しました');
  }
};

export const publishTalkScriptVersion = async (
  accessToken: string,
  versionId: string,
): Promise<void> => {
  const response = await fetch(
    `${apiBaseUrl}/talk-scripts/versions/${encodeURIComponent(versionId)}/publish`,
    {
      method: 'POST',
      headers: createAuthHeaders(accessToken),
      cache: 'no-store',
    },
  );
  if (!response.ok) {
    throw new Error('トークスクリプトの公開に失敗しました');
  }
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

