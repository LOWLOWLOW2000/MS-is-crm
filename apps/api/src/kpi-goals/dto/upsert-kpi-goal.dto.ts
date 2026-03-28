import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export const KPI_GOAL_SCOPE_VALUES = ['project', 'is_all', 'is_user'] as const;
export type KpiGoalScope = (typeof KPI_GOAL_SCOPE_VALUES)[number];

export class UpsertKpiGoalDto {
  @IsIn(KPI_GOAL_SCOPE_VALUES)
  scope!: KpiGoalScope;

  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsNumber()
  @Min(0)
  callPerHour!: number;

  @IsNumber()
  @Min(0)
  appointmentRate!: number;

  @IsNumber()
  @Min(0)
  materialSendRate!: number;

  @IsNumber()
  @Min(0)
  redialAcquisitionRate!: number;

  @IsNumber()
  @Min(0)
  cutContactRate!: number;

  @IsNumber()
  @Min(0)
  keyPersonContactRate!: number;
}
