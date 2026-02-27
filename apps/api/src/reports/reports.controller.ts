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
import { ReportSummaryDto } from './dto/report-summary.dto';
import { ReportsService } from './reports.service';

interface JwtRequest extends Request {
  user: JwtPayload;
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

  /**
   * AIスコアカード一覧（Phase2で実装予定。現時点では空配列）
   */
  @Get('ai-scorecard')
  getAiScorecard(@Req() req: JwtRequest): AiScorecardEntryDto[] {
    try {
      return this.reportsService.getAiScorecard(req.user);
    } catch {
      throw new InternalServerErrorException('AIスコアカードの取得に失敗しました');
    }
  }
}
