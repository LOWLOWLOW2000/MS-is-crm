/**
 * バッチAI処理が POST /ai/call-evaluations/batch に送る1件分の評価
 */
export interface AiCallEvaluationItemDto {
  callRecordId: string;
  zoomCallLogId: string | null;
  evaluatedAt: string;
  categoryScores: {
    category: string;
    score: number;
    tagCount: number;
    tags: { tag: string; value: string | number }[];
  }[];
  summary: string | null;
  improvementPoints: string[] | null;
}

export interface BatchCallEvaluationsDto {
  tenantId: string;
  evaluations: AiCallEvaluationItemDto[];
}
