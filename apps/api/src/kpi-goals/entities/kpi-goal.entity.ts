import type { KpiGoalScope } from '../dto/upsert-kpi-goal.dto';

export interface KpiGoalEntity {
  id: string;
  tenantId: string;
  projectId: string;
  scope: KpiGoalScope;
  targetUserId: string | null;
  callPerHour: number;
  appointmentRate: number;
  materialSendRate: number;
  redialAcquisitionRate: number;
  cutContactRate: number;
  keyPersonContactRate: number;
  updatedBy: string;
  updatedAt: string;
}

export interface KpiGoalMatrixEntity {
  projectGoal: KpiGoalEntity | null;
  isAllGoal: KpiGoalEntity | null;
  isUserGoals: KpiGoalEntity[];
}
