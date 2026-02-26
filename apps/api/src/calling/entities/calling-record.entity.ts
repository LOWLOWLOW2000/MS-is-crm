export type CallingResultType =
  | '担当者あり興味'
  | '担当者あり不要'
  | '不在'
  | '番号違い'
  | '断り'
  | '折り返し依頼'
  | '留守電';

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

