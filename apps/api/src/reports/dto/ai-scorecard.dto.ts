import type { AiCategoryScore } from '../../calling/entities/calling-ai-evaluation.entity';

/**
 * 通話1件分のAI評価結果（APIレスポンス用）
 * 契約:
 * - evaluatedAt は必ず ISO 8601 文字列
 * - categoryScores は常に配列（不正値は除外済み）
 * - summary は null 許容
 * - improvementPoints は null または空要素除去済み文字列配列
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
 * 契約:
 * - callDate は必ず ISO 8601 文字列（欠損/不正時はフォールバック済み）
 * - evaluatedAt は ISO 8601 文字列または null
 * - evaluation は評価レコードがある場合に返却される（現状実装では null にならない）
 * - 並び順は new Date(evaluatedAt ?? callDate) の降順、同値時 callRecordId 昇順
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
