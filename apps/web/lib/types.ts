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
  email: string;
  name: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export type CallingResultType =
  | '担当者あり興味'
  | '担当者あり不要'
  | '不在'
  | '番号違い'
  | '断り'
  | '折り返し依頼'
  | '留守電';

export interface SaveCallingRecordInput {
  companyName: string;
  companyPhone: string;
  companyAddress: string;
  targetUrl: string;
  approved: boolean;
  approvedAt?: string;
  result: CallingResultType;
  memo?: string;
  nextCallAt?: string;
}

export interface CallingRecord {
  id: string;
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
  nextCallAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CallingSummary {
  totalCallsToday: number;
  connectedRate: number;
  recallScheduledCount: number;
}

export interface CallingApproval {
  id: string;
  tenantId: string;
  approvedBy: string;
  approvedAt: string;
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
  sourceType: 'csv';
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
  companyName: string;
  phone: string;
  address: string;
  targetUrl: string;
  industryTag: string | null;
  createdAt: string;
}

export interface ImportListResult {
  list: CallingList;
  importedCount: number;
  skippedCount: number;
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

export interface CallingSettings {
  tenantId: string;
  humanApprovalEnabled: boolean;
  updatedBy: string;
  updatedAt: string;
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
  unassignedAt: string;
}
