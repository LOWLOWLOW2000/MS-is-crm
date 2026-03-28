import type { CallingResultType } from '../calling-result-canonical';

export type { CallingResultType };

/**
 * 汎用の架電結果（正のデータは正規名 11 種のみ。DIP等は入力UX・エクスポート時にマッピング）。
 */
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
  /** 架電結果（正規名 11 種） */
  result: CallingResultType;
  memo: string;
  nextCallAt: string | null;
  createdAt: string;
  updatedAt: string;
}
