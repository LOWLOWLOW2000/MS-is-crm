export type UserRole =
  | 'developer'
  | 'enterprise_admin'
  | 'is_admin'
  | 'director'
  | 'is_member';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

export interface AuthUser {
  id: string;
  tenantId: string;
  role: UserRole;
  roles: UserRole[];
  email: string;
  name: string;
  /** API が付与。表示は companyName 優先のテナント名 */
  tenantCompanyName?: string;
  /** テナントの PJ 表示名 */
  tenantProjectName?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
  user: AuthUser;
}

import type { CallingResultType } from './calling-result-canonical';
export type { CallingResultType } from './calling-result-canonical';
export { CALLING_RESULT_VALUES, normalizeCallingResult } from './calling-result-canonical';

/** テナント（企業アカウント）プロフィール。GET/PATCH /tenants/me */
export interface TenantProfile {
  id: string
  name: string
  companyName: string | null
  headOfficeAddress: string | null
  headOfficePhone: string | null
  representativeName: string | null
  accountStatus: string
  projectDisplayName: string | null
  accountManagerUserIds: string[]
  createdAt: string
  updatedAt: string
}

export interface UpdateTenantBody {
  companyName?: string
  headOfficeAddress?: string
  headOfficePhone?: string
  representativeName?: string
  projectDisplayName?: string
  accountStatus?: string
  accountManagerUserIds?: string[]
}

export type DirectorRequestType = 'appointment' | 'material'

export type DirectorRequestRow = {
  id: string
  type: DirectorRequestType
  /** 架電結果の記録日時（面談アポ日時とは別） */
  resultCapturedAt: string
  companyName: string
  targetUrl: string
  memo: string
  createdByUserId: string
  createdByName?: string
  isRead: boolean
  directorReadAt: string | null
}

export type DirectorRequestSummary = {
  unreadTotal: number
  unreadAppointment: number
  unreadMaterial: number
}

/** IS 向け: 自分のアポ・資料送付件数（calling/my-appointment-material/summary） */
export interface MyAppointmentMaterialSummary {
  total: number
  appointment: number
  material: number
}

export interface SaveCallingRecordInput {
  companyName: string;
  companyPhone: string;
  companyAddress: string;
  targetUrl: string;
  approved: boolean;
  approvedAt?: string;
  result: CallingResultType;
  /** 指定時は ListItem.callingResult を更新（架電ルームと配布の整合） */
  listItemId?: string;
  memo?: string;
  /** アポ／資料などテナントフォーマットに沿ったキー値 */
  structuredReport?: Record<string, unknown>;
  nextCallAt?: string;
}

export interface CallingRecord {
  /** 架電履歴ID（calling_records の一意識別子） */
  callingHistoryId: string;
  tenantId: string;
  createdBy: string;
  companyName: string;
  companyPhone: string;
  companyAddress: string;
  targetUrl: string;
  approved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  result: CallingResultType;
  memo: string;
  structuredReport: Record<string, unknown> | null;
  nextCallAt: string | null;
  /** 架電結果の記録日時（面談アポ日時とは別） */
  resultCapturedAt: string;
  updatedAt: string;
}

/** GET /calling/reporting-formats の1行 */
export interface ReportingFormatDefinitionRow {
  kind: string
  schemaJson: Record<string, unknown>
}

/** L1: 企業グループ（Ultimate Parent） */
export interface CompanyGroup {
  id: string;
  tenantId: string;
  name: string;
  listedFlag: string | null;
  creditInfo: string | null;
  createdAt: string;
  updatedAt: string;
}

/** L2: 法人エンティティ（Legal Entity） */
export interface LegalEntity {
  id: string;
  tenantId: string;
  companyGroupId: string | null;
  corporateNumber: string | null;
  name: string;
  headOfficeAddress: string | null;
  /** 画面用ステータス（精査/配布フローで利用想定） */
  status?: string | null;
  establishedAt: string | null;
  capital: string | null;
  revenue: string | null;
  operatingProfit: string | null;
  fiscalYearEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

/** L3: 拠点・事業所（Establishment） */
export interface Establishment {
  id: string;
  tenantId: string;
  legalEntityId: string;
  name: string;
  address: string | null;
  type: string | null;
  createdAt: string;
  updatedAt: string;
}

/** L4: 組織・部署（Department） */
export interface Department {
  id: string;
  tenantId: string;
  legalEntityId: string;
  name: string;
  roleCategory: string | null;
  createdAt: string;
  updatedAt: string;
}

/** L5: 担当者・キーマン（Persona） */
export interface Persona {
  id: string;
  tenantId: string;
  legalEntityId: string;
  departmentId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  roleRank: string | null;
  authority: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 企業詳細表示用：法人＋グループ＋担当者一覧 */
export interface CompanyInfo {
  legalEntity: LegalEntity;
  companyGroup: CompanyGroup | null;
  departments: Department[];
  personas: Persona[];
}

export interface CompanyDetailResponse {
  id: string;
  tenantId: string;
  companyGroupId: string | null;
  corporateNumber: string | null;
  name: string;
  headOfficeAddress: string | null;
  status?: string | null;
  establishedAt: string | null;
  capital: string | null;
  revenue: string | null;
  operatingProfit: string | null;
  fiscalYearEnd: string | null;
  createdAt: string;
  updatedAt: string;
  establishments: Establishment[];
  departments: Department[];
  personas: (Persona & { department?: Department | null })[];
}

export type UpdateCompanyInput = {
  legalEntity: { name: string; headOfficeAddress?: string; status?: string };
  establishments: { name: string; address?: string; type?: string }[];
  personas: { name: string; departmentName?: string; phone?: string; email?: string }[];
}

export type UpdateCompanyResult = {
  company: CompanyDetailResponse;
  canUndo: boolean;
}

export interface CallingSummary {
  totalCallsToday: number;
  connectedRate: number;
  recallScheduledCount: number;
}

/** リスト精査終了（リスト確認が承認終わった時点）。id = リスト精査終了ID、reviewCompletedAt = リスト精査終了日 */
export interface ListReviewCompletion {
  /** リスト精査終了ID */
  id: string;
  tenantId: string;
  completedBy: string;
  /** リスト精査終了日 */
  reviewCompletedAt: string;
  targetUrl: string;
  companyName: string;
}

export interface DialValidationResult {
  canDial: boolean;
  reason?: string;
}

export interface CallingHelpRequest {
  id: string;
  tenantId: string;
  requestedBy: string;
  requestedByEmail: string;
  companyName: string;
  scriptTab: string;
  requestedAt: string;
  queueNumber: number;
  status: 'waiting' | 'joined' | 'closed';
  joinedBy: string | null;
  joinedAt: string | null;
  resolvedAt: string | null;
}

export interface CallStartedEvent {
  tenantId: string;
  startedBy: string;
  companyName: string;
  meetingId: string;
  startedAt: string;
}

export interface ListDistributedEvent {
  tenantId: string;
  listId: string;
  listName: string;
  itemCount: number;
  distributedAt: string;
}

export interface RecallReminderEvent {
  tenantId: string;
  recordId: string;
  companyName: string;
  nextCallAt: string;
  reminderType: '5min' | '2min';
}

export interface CallingList {
  id: string;
  tenantId: string;
  name: string;
  sourceType: 'csv' | 'auto';
  createdBy: string;
  createdAt: string;
  itemCount: number;
  assigneeEmail: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
}

export interface ListItem {
  id: string;
  tenantId: string;
  listId: string;
  /** 親リストの表示名（ディレクターが命名・格納時） */
  listName?: string | null;
  /** 架電ルームで記録した最新の架電結果（正規名） */
  callingResult?: string | null;
  companyName: string;
  phone: string;
  address: string;
  /** 企業（Legal Entity）ID。persona（担当者）を紐付ける */
  legalEntityId?: string | null;
  targetUrl: string;
  industryTag: string | null;
  aiListTier?: string | null;
  assignedToUserId?: string | null;
  assignedAt?: string | null;
  assignedByUserId?: string | null;
  status?: 'unstarted' | 'calling' | 'done' | 'excluded' | string;
  statusUpdatedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export type ListItemStatus = 'unstarted' | 'calling' | 'done' | 'excluded'

export interface ImportListResult {
  list: CallingList;
  importedCount: number;
  skippedCount: number;
}

/** リスト生成用マスタ（エリア・業種・キーワード） */
export interface ListMasterItem {
  id: string;
  name: string;
  isActive: boolean;
}

/** 配布画面: 業種マスタ（大分類ラベル付き） */
export interface ListIndustryMasterRow {
  id: string;
  name: string;
  groupLabel: string | null;
}

/** リスト生成リクエスト（履歴一覧用） */
export interface ListGenerationRequest {
  id: string;
  status: string;
  assignedToEmail: string;
  resultListId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  input: unknown;
}

/** AIアドバイス応答（ダミー実装） */
export interface ListAdviceResponse {
  advice: string;
  suggestedActions: {
    type: 'generate' | 'assign_existing';
    title: string;
    payload: Record<string, unknown>;
  }[];
}

export interface ZoomCallLog {
  id: string;
  tenantId: string;
  meetingId: string | null;
  meetingUuid: string | null;
  topic: string | null;
  hostEmail: string | null;
  status: 'started' | 'ended';
  startedAt: string | null;
  endedAt: string | null;
  eventType: string;
  receivedAt: string;
}

export interface ZoomDialSession {
  provider: 'zoom';
  meetingId: string;
  topic: string;
  joinUrl: string;
  startUrl: string;
  scheduledAt: string;
  isFallback: boolean;
}

export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export interface ReportSummary {
  period: ReportPeriod;
  startAt: string;
  endAt: string;
  totalCalls: number;
  connectedRate: number;
  resultBreakdown: {
    result: string;
    count: number;
  }[];
}

export interface ReportByMemberItem {
  userId: string;
  email: string;
  name: string;
  totalCalls: number;
  connectedCount: number;
  connectedRate: number;
  appointmentCount: number;
  materialSendCount: number;
  interestedCount: number;
  recallScheduledCount: number;
}

export interface ReportByMember {
  period: ReportPeriod;
  startAt: string;
  endAt: string;
  members: ReportByMemberItem[];
}

export type KpiTimeseriesScope = 'personal' | 'team'

export interface KpiTimeseriesPoint {
  date: string
  totalCalls: number
  connectedCount: number
  appointmentCount: number
  materialSendCount: number
  recallScheduledCount: number
}

export interface KpiTimeseries {
  startAt: string
  endAt: string
  scope: KpiTimeseriesScope
  points: KpiTimeseriesPoint[]
}

export type CallProviderKind = 'mock' | 'zoom_embed' | 'external_url' | 'webhook'

export interface CallingSettings {
  tenantId: string;
  humanApprovalEnabled: boolean;
  callProviderKind: CallProviderKind;
  callProviderConfig: Record<string, unknown> | null;
  /** テナントで1回承認済みのとき ISO 8601（全ユーザーで架電ルーム承認ボタン非表示） */
  salesRoomContentAckAt: string | null;
  salesRoomContentAckBy: string | null;
  updatedBy: string;
  updatedAt: string;
}

export type TalkScriptType = 'linear' | 'branching'

/** 公開版サマリ（一覧用） */
export interface TalkScriptPublishedSummary {
  id: string;
  label: string;
  publishedAt: string | null;
  updatedAt: string;
}

/** 下書きサマリ */
export interface TalkScriptDraftSummary {
  id: string;
  label: string;
  status: string;
  updatedAt: string;
}

/** 公開版の本文付き */
export interface TalkScriptPublishedDetail {
  id: string;
  type: TalkScriptType;
  label: string;
  content: unknown;
}

/** 編集用 */
export interface TalkScriptDraftDetail {
  id: string;
  type: TalkScriptType;
  label: string;
  status: string;
  content: unknown;
}

export type KpiGoalScope = 'project' | 'is_all' | 'is_user'

export interface KpiGoalValues {
  callPerHour: number
  appointmentRate: number
  materialSendRate: number
  redialAcquisitionRate: number
  cutContactRate: number
  keyPersonContactRate: number
}

export interface KpiGoal extends KpiGoalValues {
  id: string
  tenantId: string
  projectId: string
  scope: KpiGoalScope
  targetUserId: string | null
  updatedBy: string
  updatedAt: string
}

export interface KpiGoalMatrix {
  projectGoal: KpiGoal | null
  isAllGoal: KpiGoal | null
  isUserGoals: KpiGoal[]
}

export interface ScriptTab {
  id: string;
  name: string;
  content: string;
  isCustom: boolean;
}

export interface ScriptTemplate {
  id: string;
  tenantId: string;
  name: string;
  industryTag: string | null;
  tabs: ScriptTab[];
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListAssignedEvent {
  tenantId: string;
  listId: string;
  listName: string;
  assigneeEmail: string;
  assignedBy: string;
  assignedAt: string;
}

export interface ListUnassignedEvent {
  tenantId: string;
  listId: string;
  listName: string;
  previousAssigneeEmail: string | null;
  unassignedBy: string;
  unassignedAt: string;
}

/** AIスコアカード一覧用（GET /reports/ai-scorecard）。後から実装を埋める */
export interface AiScorecardEntry {
  callRecordId: string;
  tenantId: string;
  companyName: string;
  isMemberEmail: string;
  callDate: string;
  durationSeconds: number;
  result: string;
  overallScore: number | null;
  evaluatedAt: string | null;
  evaluation: {
    id: string;
    tenantId: string;
    callRecordId: string;
    zoomCallLogId: string | null;
    evaluatedAt: string;
    categoryScores: { category: string; score: number; tagCount: number; tags: { tag: string; value: string | number }[] }[];
    summary: string | null;
    improvementPoints: string[] | null;
  } | null;
}
