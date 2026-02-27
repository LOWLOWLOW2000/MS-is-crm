import type { AiCategoryScore } from '../../calling/entities/calling-ai-evaluation.entity';

/**
 * 通話1件分のAI評価結果（APIレスポンス用）
 */
export interface AiCallEvaluationDto {
  id: string;
  tenantId: string;
  callRecordId: string;
  zoomCallLogId: string | null;
  evaluatedAt: string;
  categoryScores: AiCategoryScore[];
  summary: string | null;
  improvementPoints: string[] | null;
}

/**
 * AIスコアカード一覧用（GET /reports/ai-scorecard のレスポンス型）
 */
export interface AiScorecardEntryDto {
  callRecordId: string;
  tenantId: string;
  companyName: string;
  isMemberEmail: string;
  callDate: string;
  durationSeconds: number;
  result: string;
  overallScore: number | null;
  evaluatedAt: string | null;
  evaluation: AiCallEvaluationDto | null;
}
