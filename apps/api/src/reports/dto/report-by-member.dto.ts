import type { ReportPeriod } from './report-summary.dto';

export interface ReportByMemberItemDto {
  userId: string;
  email: string;
  name: string;
  totalCalls: number;
  connectedCount: number;
  connectedRate: number;
  /** アポ数（CallingRecord.result が 'アポ'） */
  appointmentCount: number;
  /** 資料送付数（CallingRecord.result が '資料送付'） */
  materialSendCount: number;
  /** 興味接触数（CallingRecord.result が正規名「再架電」） */
  interestedCount: number;
  /** 再加電の予定数（nextCallAt が null ではなく現在時刻より未来） */
  recallScheduledCount: number;
}

export interface ReportByMemberDto {
  period: ReportPeriod;
  startAt: string;
  endAt: string;
  members: ReportByMemberItemDto[];
}
