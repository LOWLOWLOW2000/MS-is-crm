/**
 * 汎用の架電結果（正のデータはこれのみ保持。DIP等は入力UX・エクスポート時にマッピング）。
 * docs/dip-mvp-spec.md §汎用結果タイプ
 */
export type CallingResultType =
  | '担当者あり興味'
  | '担当者あり不要'
  | '不在'
  | '番号違い'
  | '断り'
  | '折り返し依頼'
  | '留守電'
  | '資料送付'
  | 'アポ'
  | 'リスト除外'
  | '不通';

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
  /** 汎用結果のみ。DBは String で保持 */
  result: CallingResultType;
  memo: string;
  nextCallAt: string | null;
  createdAt: string;
  updatedAt: string;
}

