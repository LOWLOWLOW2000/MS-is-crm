import type { ReportPeriod } from './report-summary.dto';

export interface ReportByMemberItemDto {
  userId: string;
  email: string;
  name: string;
  totalCalls: number;
  connectedCount: number;
  connectedRate: number;
}

export interface ReportByMemberDto {
  period: ReportPeriod;
  startAt: string;
  endAt: string;
  members: ReportByMemberItemDto[];
}
