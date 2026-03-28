import { Injectable } from '@nestjs/common';
import { effectiveConnectionCountForRecords } from '../calling/calling-result-rules';
import { isConnectedResult, isInterestedResult } from '../calling/calling-result-helpers';
import { CallingService } from '../calling/calling.service';
import { CallingRecord } from '../calling/entities/calling-record.entity';
import type { AiCategoryScore } from '../calling/entities/calling-ai-evaluation.entity';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import type { AiCallEvaluationDto, AiScorecardEntryDto } from './dto/ai-scorecard.dto';
import type { ReportByMemberDto, ReportByMemberItemDto } from './dto/report-by-member.dto';
import {
  ReportPeriod,
  ReportResultBreakdownItem,
  ReportSummaryDto,
} from './dto/report-summary.dto';
import type { KpiTimeseriesDto, KpiTimeseriesPointDto, KpiTimeseriesScope } from './reports.controller'

@Injectable()
export class ReportsService {
  constructor(
    private readonly callingService: CallingService,
    private readonly prisma: PrismaService,
  ) {}

  private resolvePeriod = (raw: string | undefined): ReportPeriod => {
    if (raw === 'weekly' || raw === 'monthly') {
      return raw;
    }
    return 'daily';
  };

  private resolveRange = (
    period: ReportPeriod,
    rawFrom?: string,
    rawTo?: string,
  ): { startAt: Date; endAt: Date } => {
    const from = typeof rawFrom === 'string' ? rawFrom.trim() : ''
    const to = typeof rawTo === 'string' ? rawTo.trim() : ''
    if (from && to) {
      const fromDate = new Date(`${from}T00:00:00`)
      const toDate = new Date(`${to}T23:59:59.999`)
      if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime()) && fromDate.getTime() <= toDate.getTime()) {
        return { startAt: fromDate, endAt: toDate }
      }
    }
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

  private toDateKeyUtc = (date: Date): string => {
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  private sanitizeCategoryScores = (raw: unknown): AiCategoryScore[] => {
    if (!Array.isArray(raw)) return []
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const row = item as {
          category?: unknown
          score?: unknown
          tagCount?: unknown
          tags?: unknown
        }
        const tags = Array.isArray(row.tags)
          ? row.tags
              .map((tag) => {
                if (!tag || typeof tag !== 'object') return null
                const t = tag as { tag?: unknown; value?: unknown }
                if (typeof t.tag !== 'string') return null
                if (typeof t.value !== 'string' && typeof t.value !== 'number') return null
                return { tag: t.tag, value: t.value }
              })
              .filter((tag): tag is { tag: string; value: string | number } => tag !== null)
              .sort((a, b) => a.tag.localeCompare(b.tag))
          : []
        const safeTagCount = typeof row.tagCount === 'number' && Number.isFinite(row.tagCount)
          ? row.tagCount
          : tags.length
        return {
          category: typeof row.category === 'string' ? row.category : 'unknown',
          score: typeof row.score === 'number' && Number.isFinite(row.score) ? row.score : 0,
          tagCount: safeTagCount,
          tags,
        } satisfies AiCategoryScore
      })
      .filter((item): item is AiCategoryScore => item !== null)
      .sort((a, b) => b.score - a.score || a.category.localeCompare(b.category))
  }

  private toIsoStringOrNull = (raw: unknown): string | null => {
    if (typeof raw !== 'string' && !(raw instanceof Date)) return null
    const date = raw instanceof Date ? raw : new Date(raw)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  private sanitizeNonEmptyString = (raw: unknown): string | null => {
    if (typeof raw !== 'string') return null
    const trimmed = raw.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  private sanitizeImprovementPoints = (raw: unknown): string[] | null => {
    if (!Array.isArray(raw)) return null
    const points = raw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
    return points.length > 0 ? points : null
  }

  private resolveAiScorecardSortTimestamp = (entry: Pick<AiScorecardEntryDto, 'evaluatedAt' | 'callDate'>): number =>
    new Date(entry.evaluatedAt ?? entry.callDate).getTime()

  getSummary = async (user: JwtPayload, rawPeriod: string | undefined): Promise<ReportSummaryDto> => {
    const period = this.resolvePeriod(rawPeriod);
    const { startAt, endAt } = this.resolveRange(period);
    const startMs = startAt.getTime();
    const endMs = endAt.getTime();

    const tenantRecords = await this.callingService.getTenantRecords(user.tenantId);
    const periodRecords = tenantRecords.filter((record: CallingRecord) => {
      const createdMs = new Date(record.createdAt).getTime();
      return createdMs >= startMs && createdMs <= endMs;
    });

    const connectedCount = effectiveConnectionCountForRecords(
      periodRecords.map((r: CallingRecord) => ({
        result: r.result,
        targetUrl: r.targetUrl,
        companyPhone: r.companyPhone,
      })),
    );

    const resultCounter = new Map<string, number>();
    periodRecords.forEach((record: CallingRecord) => {
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

  /** ISメンバー別の架電実績（件数・接続率）。期間は summary と同じ。 */
  getByMember = async (
    user: JwtPayload,
    rawPeriod: string | undefined,
    rawFrom?: string,
    rawTo?: string,
  ): Promise<ReportByMemberDto> => {
    const period = this.resolvePeriod(rawPeriod);
    const { startAt, endAt } = this.resolveRange(period, rawFrom, rawTo);
    const startMs = startAt.getTime();
    const endMs = endAt.getTime();
    const nowMs = Date.now();

    const tenantRecords = await this.callingService.getTenantRecords(user.tenantId);
    const periodRecords = tenantRecords.filter((record: CallingRecord) => {
      const createdMs = new Date(record.createdAt).getTime();
      return createdMs >= startMs && createdMs <= endMs;
    });

    const byUserId = new Map<
      string,
      {
        total: number;
        connected: number;
        interested: number;
        appointment: number;
        materialSend: number;
        recallScheduled: number;
      }
    >();
    for (const record of periodRecords) {
      const cur = byUserId.get(record.createdBy) ?? {
        total: 0,
        connected: 0,
        interested: 0,
        appointment: 0,
        materialSend: 0,
        recallScheduled: 0,
      };
      cur.total += 1;
      if (isInterestedResult(record.result)) {
        cur.connected += 1;
        cur.interested += 1;
      } else if (isConnectedResult(record.result) && !isInterestedResult(record.result)) {
        cur.connected += 1;
      }

      if (record.result === 'アポ') cur.appointment += 1;
      if (record.result === '資料送付') cur.materialSend += 1;

      if (record.nextCallAt) {
        const nextMs = new Date(record.nextCallAt).getTime();
        if (!Number.isNaN(nextMs) && nextMs > nowMs) cur.recallScheduled += 1;
      }
      byUserId.set(record.createdBy, cur);
    }

    const userIds = Array.from(byUserId.keys());
    const userRows =
      userIds.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: { id: { in: userIds }, tenantId: user.tenantId },
            select: { id: true, email: true, name: true },
          });

    const userMap = new Map(userRows.map((r) => [r.id, r]));
    const members: ReportByMemberItemDto[] = [];
    for (const [userId, stats] of byUserId.entries()) {
      const u = userMap.get(userId);
      members.push({
        userId,
        email: u?.email ?? '',
        name: u?.name ?? '',
        totalCalls: stats.total,
        connectedCount: stats.connected,
        connectedRate: stats.total === 0 ? 0 : Math.round((stats.connected / stats.total) * 100),
        appointmentCount: stats.appointment,
        materialSendCount: stats.materialSend,
        interestedCount: stats.interested,
        recallScheduledCount: stats.recallScheduled,
      });
    }
    members.sort((a, b) => b.totalCalls - a.totalCalls);

    return {
      period,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      members,
    };
  };

  getKpiTimeseries = async (
    user: JwtPayload,
    rawFrom?: string,
    rawTo?: string,
    rawScope?: string,
  ): Promise<KpiTimeseriesDto> => {
    const scope: KpiTimeseriesScope = rawScope === 'team' ? 'team' : 'personal'
    const { startAt, endAt } = this.resolveRange('monthly', rawFrom, rawTo)
    const startMs = startAt.getTime()
    const endMs = endAt.getTime()
    const nowMs = Date.now()

    const tenantRecords = await this.callingService.getTenantRecords(user.tenantId)
    const filtered = tenantRecords.filter((record) => {
      if (scope === 'personal' && record.createdBy !== user.sub) return false
      const createdMs = new Date(record.createdAt).getTime()
      return createdMs >= startMs && createdMs <= endMs
    })

    const byDate = new Map<string, Omit<KpiTimeseriesPointDto, 'date'>>()
    for (const record of filtered) {
      const createdAt = new Date(record.createdAt)
      const key = this.toDateKeyUtc(createdAt)
      const cur = byDate.get(key) ?? {
        totalCalls: 0,
        connectedCount: 0,
        appointmentCount: 0,
        materialSendCount: 0,
        recallScheduledCount: 0,
      }

      cur.totalCalls += 1
      if (isConnectedResult(record.result)) {
        cur.connectedCount += 1
      }
      if (record.result === 'アポ') cur.appointmentCount += 1
      if (record.result === '資料送付') cur.materialSendCount += 1
      if (record.nextCallAt) {
        const nextMs = new Date(record.nextCallAt).getTime()
        if (!Number.isNaN(nextMs) && nextMs > nowMs) cur.recallScheduledCount += 1
      }
      byDate.set(key, cur)
    }

    const points = Array.from(byDate.entries())
      .map(([date, row]) => ({ date, ...row }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      scope,
      points,
    }
  }

  /**
   * Phase3: AIスコアカード一覧。CallingAiEvaluation が存在する架電記録を一覧化し、IS別に返す。
   */
  getAiScorecard = async (user: JwtPayload): Promise<AiScorecardEntryDto[]> => {
    const evals = await this.prisma.callingAiEvaluation.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { evaluatedAt: 'desc' },
    });
    if (evals.length === 0) return [];
    const recordIds = [...new Set(evals.map((e) => e.callRecordId))];
    const records = await this.prisma.callingRecord.findMany({
      where: { callingHistoryId: { in: recordIds }, tenantId: user.tenantId },
    });
    const recordMap = new Map(records.map((r) => [r.callingHistoryId, r]));
    const userIds = [...new Set(records.map((r) => r.createdBy))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, tenantId: user.tenantId },
      select: { id: true, email: true },
    });
    const emailByUserId = new Map(users.map((u) => [u.id, u.email]));
    const entries: AiScorecardEntryDto[] = evals.flatMap((e) => {
        const record = recordMap.get(e.callRecordId)
        if (!record) return []

        const evaluatedAt = this.toIsoStringOrNull(e.evaluatedAt)
        const callDate = this.toIsoStringOrNull(record.createdAt) ?? new Date(0).toISOString()
      const categoryScores = this.sanitizeCategoryScores(e.categoryScores)
      const avgScore =
        categoryScores.length > 0
          ? categoryScores.reduce((sum, c) => sum + (c.score ?? 0), 0) / categoryScores.length
          : null;
      const overallScore = avgScore !== null ? Math.round(avgScore * 10) / 10 : null;
      const evaluation: AiCallEvaluationDto = {
        id: e.id,
        tenantId: e.tenantId,
        callRecordId: record.callingHistoryId,
        zoomCallLogId: null,
        evaluatedAt: evaluatedAt ?? callDate,
        categoryScores,
        summary: this.sanitizeNonEmptyString(e.summary),
        improvementPoints: this.sanitizeImprovementPoints(e.improvementPoints),
      };
        return [{
          callRecordId: record.callingHistoryId,
          tenantId: record.tenantId,
          companyName: record.companyName,
          isMemberEmail: emailByUserId.get(record.createdBy) ?? '',
          callDate,
          durationSeconds: 0,
          result: record.result,
          overallScore,
          evaluatedAt,
          evaluation,
        } satisfies AiScorecardEntryDto]
      })

    return entries.sort((a, b) => {
      const timeDiff = this.resolveAiScorecardSortTimestamp(b) - this.resolveAiScorecardSortTimestamp(a)
      if (timeDiff !== 0) return timeDiff
      return a.callRecordId.localeCompare(b.callRecordId)
    })
  };

  /** Phase3 スタブ: 黄金トークパターン */
  getGoldenPatterns = async (_user: JwtPayload): Promise<{ patterns: unknown[]; period: string }> => {
    return { patterns: [], period: 'monthly' };
  };

  /** Phase3 スタブ: 最適架電時間帯マップ */
  getOptimalTimeMap = async (_user: JwtPayload): Promise<{ heatmap: unknown[]; period: string }> => {
    return { heatmap: [], period: 'monthly' };
  };

  /** Phase3 スタブ: 商談パイプライン予測 */
  getPipelineForecast = async (_user: JwtPayload): Promise<{ forecast: unknown; period: string }> => {
    return { forecast: {}, period: 'monthly' };
  };
}
