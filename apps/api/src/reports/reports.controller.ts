import {
  Controller,
  Get,
  InternalServerErrorException,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AiScorecardEntryDto } from './dto/ai-scorecard.dto';
import type { ReportByMemberDto } from './dto/report-by-member.dto';
import { ReportSummaryDto } from './dto/report-summary.dto';
import { ReportsService } from './reports.service';

interface JwtRequest extends Request {
  user: JwtPayload;
}

export type KpiTimeseriesScope = 'personal' | 'team'

export interface KpiTimeseriesPointDto {
  date: string
  totalCalls: number
  connectedCount: number
  appointmentCount: number
  materialSendCount: number
  recallScheduledCount: number
}

export interface KpiTimeseriesDto {
  startAt: string
  endAt: string
  scope: KpiTimeseriesScope
  points: KpiTimeseriesPointDto[]
}

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  async getSummary(
    @Req() req: JwtRequest,
    @Query('period') period: string | undefined,
  ): Promise<ReportSummaryDto> {
    try {
      return await this.reportsService.getSummary(req.user, period);
    } catch {
      throw new InternalServerErrorException('レポート集計の取得に失敗しました');
    }
  }

  /** ISメンバー別の架電実績。period は daily | weekly | monthly */
  @Get('by-member')
  async getByMember(
    @Req() req: JwtRequest,
    @Query('period') period: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
  ): Promise<ReportByMemberDto> {
    try {
      return await this.reportsService.getByMember(req.user, period, from, to);
    } catch {
      throw new InternalServerErrorException('IS別実績の取得に失敗しました');
    }
  }

  /** KPI（時系列）。from/to を優先し、scope=personal|team */
  @Get('kpi-timeseries')
  async getKpiTimeseries(
    @Req() req: JwtRequest,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('scope') scope: string | undefined,
  ): Promise<KpiTimeseriesDto> {
    try {
      return await this.reportsService.getKpiTimeseries(req.user, from, to, scope)
    } catch {
      throw new InternalServerErrorException('KPI時系列の取得に失敗しました')
    }
  }

  /**
   * Phase3: AIスコアカード一覧（評価が付いた架電記録）
   */
  @Get('ai-scorecard')
  async getAiScorecard(@Req() req: JwtRequest): Promise<AiScorecardEntryDto[]> {
    try {
      return await this.reportsService.getAiScorecard(req.user);
    } catch {
      throw new InternalServerErrorException('AIスコアカードの取得に失敗しました');
    }
  }

  /** Phase3 スタブ: 黄金トークパターン */
  @Get('golden-patterns')
  async getGoldenPatterns(@Req() req: JwtRequest): Promise<{ patterns: unknown[]; period: string }> {
    try {
      return await this.reportsService.getGoldenPatterns(req.user);
    } catch {
      throw new InternalServerErrorException('黄金トークパターンの取得に失敗しました');
    }
  }

  /** Phase3 スタブ: 最適架電時間帯マップ */
  @Get('optimal-time-map')
  async getOptimalTimeMap(@Req() req: JwtRequest): Promise<{ heatmap: unknown[]; period: string }> {
    try {
      return await this.reportsService.getOptimalTimeMap(req.user);
    } catch {
      throw new InternalServerErrorException('最適時間帯マップの取得に失敗しました');
    }
  }

  /** Phase3 スタブ: 商談パイプライン予測 */
  @Get('pipeline-forecast')
  async getPipelineForecast(@Req() req: JwtRequest): Promise<{ forecast: unknown; period: string }> {
    try {
      return await this.reportsService.getPipelineForecast(req.user);
    } catch {
      throw new InternalServerErrorException('パイプライン予測の取得に失敗しました');
    }
  }
}
