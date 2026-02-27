export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export interface ReportResultBreakdownItem {
  result: string;
  count: number;
}

export interface ReportSummaryDto {
  period: ReportPeriod;
  startAt: string;
  endAt: string;
  totalCalls: number;
  connectedRate: number;
  resultBreakdown: ReportResultBreakdownItem[];
}
