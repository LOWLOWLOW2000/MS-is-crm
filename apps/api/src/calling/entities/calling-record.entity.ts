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
  /** フォーマット沿いのキー値（任意） */
  structuredReport: Record<string, unknown> | null;
  nextCallAt: string | null;
  /** 架電結果の記録日時（面談アポ日時とは別） */
  resultCapturedAt: string;
  updatedAt: string;
}
