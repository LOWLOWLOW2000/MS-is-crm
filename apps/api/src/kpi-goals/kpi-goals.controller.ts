import {
  Body,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { GetKpiGoalQueryDto } from './dto/get-kpi-goal.dto';
import { UpsertKpiGoalDto } from './dto/upsert-kpi-goal.dto';
import type { KpiGoalEntity, KpiGoalMatrixEntity } from './entities/kpi-goal.entity';
import { KpiGoalsService } from './kpi-goals.service';

interface JwtRequest extends Request {
  user: JwtPayload
}

@Controller('kpi-goals')
@UseGuards(JwtAuthGuard)
export class KpiGoalsController {
  constructor(private readonly kpiGoalsService: KpiGoalsService) {}

  @Get()
  async getGoal(
    @Req() req: JwtRequest,
    @Query() query: GetKpiGoalQueryDto,
  ): Promise<KpiGoalEntity | null> {
    try {
      return await this.kpiGoalsService.getGoal(req.user, query)
    } catch {
      throw new InternalServerErrorException('KPI目標の取得に失敗しました')
    }
  }

  @Get('matrix')
  async getMatrix(@Req() req: JwtRequest): Promise<KpiGoalMatrixEntity> {
    try {
      return await this.kpiGoalsService.getMatrix(req.user)
    } catch {
      throw new InternalServerErrorException('KPI目標一覧の取得に失敗しました')
    }
  }

  @Put()
  async upsertGoal(
    @Req() req: JwtRequest,
    @Body() dto: UpsertKpiGoalDto,
  ): Promise<KpiGoalEntity> {
    try {
      return await this.kpiGoalsService.upsertGoal(req.user, dto)
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new InternalServerErrorException('KPI目標の保存に失敗しました')
    }
  }
}
