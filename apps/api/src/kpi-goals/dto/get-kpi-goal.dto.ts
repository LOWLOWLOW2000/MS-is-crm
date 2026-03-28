import { IsIn, IsOptional, IsString } from 'class-validator';
import { KPI_GOAL_SCOPE_VALUES, type KpiGoalScope } from './upsert-kpi-goal.dto';

export class GetKpiGoalQueryDto {
  @IsOptional()
  @IsIn(KPI_GOAL_SCOPE_VALUES)
  scope?: KpiGoalScope;

  @IsOptional()
  @IsString()
  targetUserId?: string;
}
