import { Injectable } from '@nestjs/common';
import { CallingService } from '../calling/calling.service';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import {
  ReportPeriod,
  ReportResultBreakdownItem,
  ReportSummaryDto,
} from './dto/report-summary.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly callingService: CallingService) {}

  private resolvePeriod = (raw: string | undefined): ReportPeriod => {
    if (raw === 'weekly' || raw === 'monthly') {
      return raw;
    }
    return 'daily';
  };

  private resolveRange = (
    period: ReportPeriod,
  ): { startAt: Date; endAt: Date } => {
    const now = new Date();
    const endAt = new Date(now);
    endAt.setHours(23, 59, 59, 999);

    const startAt = new Date(now);
    startAt.setHours(0, 0, 0, 0);

    if (period === 'weekly') {
      startAt.setDate(startAt.getDate() - 6);
    }
    if (period === 'monthly') {
      startAt.setDate(startAt.getDate() - 29);
    }

    return { startAt, endAt };
  };

  getSummary = (user: JwtPayload, rawPeriod: string | undefined): ReportSummaryDto => {
    const period = this.resolvePeriod(rawPeriod);
    const { startAt, endAt } = this.resolveRange(period);
    const startMs = startAt.getTime();
    const endMs = endAt.getTime();

    const tenantRecords = this.callingService.getTenantRecords(user.tenantId);
    const periodRecords = tenantRecords.filter((record) => {
      const createdMs = new Date(record.createdAt).getTime();
      return createdMs >= startMs && createdMs <= endMs;
    });

    const connectedCount = periodRecords.filter((record) => {
      return record.result === '担当者あり興味' || record.result === '担当者あり不要';
    }).length;

    const resultCounter = new Map<string, number>();
    periodRecords.forEach((record) => {
      resultCounter.set(record.result, (resultCounter.get(record.result) ?? 0) + 1);
    });

    const resultBreakdown: ReportResultBreakdownItem[] = Array.from(resultCounter.entries())
      .map(([result, count]) => ({ result, count }))
      .sort((a, b) => b.count - a.count);

    return {
      period,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      totalCalls: periodRecords.length,
      connectedRate:
        periodRecords.length === 0 ? 0 : Math.round((connectedCount / periodRecords.length) * 100),
      resultBreakdown,
    };
  };
}
