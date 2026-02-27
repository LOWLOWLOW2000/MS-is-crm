/**
 * 通話1件分のAI評価結果（Phase2バッチ処理後に格納）
 * ZoomCallLog / CallingRecord と紐付ける
 */
export interface AiCategoryScore {
  category: string;
  score: number;
  tagCount: number;
  tags: { tag: string; value: string | number }[];
}

export interface CallingAiEvaluation {
  id: string;
  tenantId: string;
  callRecordId: string;
  zoomCallLogId: string | null;
  evaluatedAt: string;
  categoryScores: AiCategoryScore[];
  summary: string | null;
  improvementPoints: string[] | null;
}
