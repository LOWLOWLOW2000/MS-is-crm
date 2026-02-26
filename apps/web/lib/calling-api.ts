import {
  CallingApproval,
  CallingHelpRequest,
  CallingRecord,
  CallingSummary,
  DialValidationResult,
  SaveCallingRecordInput,
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

export const createCallingApproval = async (
  accessToken: string,
  input: { companyName: string; targetUrl: string },
): Promise<CallingApproval> => {
  const response = await fetch(`${apiBaseUrl}/calling/approvals`, {
    method: 'POST',
    headers: createAuthHeaders(accessToken),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('承認情報の保存に失敗しました');
  }

  return (await response.json()) as CallingApproval;
};

export const validateDialPermission = async (
  accessToken: string,
  input: { approvalId: string; targetUrl: string },
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

