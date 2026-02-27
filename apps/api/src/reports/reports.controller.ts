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
  getSummary(
    @Req() req: JwtRequest,
    @Query('period') period: string | undefined,
  ): ReportSummaryDto {
    try {
      return this.reportsService.getSummary(req.user, period);
    } catch {
      throw new InternalServerErrorException('レポート集計の取得に失敗しました');
    }
  }
}
