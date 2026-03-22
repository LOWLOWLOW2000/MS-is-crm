import { Injectable } from '@nestjs/common';
import { effectiveConnectionCountForRecords } from '../calling/calling-result-rules';
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
  getByMember = async (user: JwtPayload, rawPeriod: string | undefined): Promise<ReportByMemberDto> => {
    const period = this.resolvePeriod(rawPeriod);
    const { startAt, endAt } = this.resolveRange(period);
    const startMs = startAt.getTime();
    const endMs = endAt.getTime();

    const tenantRecords = await this.callingService.getTenantRecords(user.tenantId);
    const periodRecords = tenantRecords.filter((record: CallingRecord) => {
      const createdMs = new Date(record.createdAt).getTime();
      return createdMs >= startMs && createdMs <= endMs;
    });

    const byUserId = new Map<string, { total: number; connected: number }>();
    for (const record of periodRecords) {
      const cur = byUserId.get(record.createdBy) ?? { total: 0, connected: 0 };
      cur.total += 1;
      if (record.result === '担当者あり興味' || record.result === '担当者あり不要') {
        cur.connected += 1;
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
    const entries: AiScorecardEntryDto[] = [];
    for (const e of evals) {
      const record = recordMap.get(e.callRecordId);
      if (!record) continue;
      const categoryScores = (e.categoryScores as unknown as AiCategoryScore[]) ?? [];
      const avgScore =
        categoryScores.length > 0
          ? categoryScores.reduce((sum, c) => sum + (c.score ?? 0), 0) / categoryScores.length
          : null;
      const overallScore = avgScore !== null ? Math.round(avgScore * 10) / 10 : null;
      const evaluation: AiCallEvaluationDto = {
        id: e.id,
        tenantId: e.tenantId,
        callRecordId: e.callRecordId,
        zoomCallLogId: null,
        evaluatedAt: e.evaluatedAt,
        categoryScores,
        summary: e.summary ?? null,
        improvementPoints: Array.isArray(e.improvementPoints) ? (e.improvementPoints as string[]) : null,
      };
      entries.push({
        callRecordId: record.callingHistoryId,
        tenantId: record.tenantId,
        companyName: record.companyName,
        isMemberEmail: emailByUserId.get(record.createdBy) ?? '',
        callDate: record.createdAt,
        durationSeconds: 0,
        result: record.result,
        overallScore,
        evaluatedAt: e.evaluatedAt,
        evaluation,
      });
    }
    return entries;
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
