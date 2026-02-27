import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import type { CallingAiEvaluation } from '../calling/entities/calling-ai-evaluation.entity';
import type { BatchCallEvaluationsDto } from './dto/batch-evaluations.dto';

@Injectable()
export class AiService {
  private readonly evaluations: CallingAiEvaluation[] = [];

  /**
   * バッチAI評価結果をテナントごとに保存（メモリ上の簡易実装）
   */
  saveBatchEvaluations = (user: JwtPayload, dto: BatchCallEvaluationsDto): void => {
    if (dto.tenantId !== user.tenantId) {
      throw new BadRequestException('tenantId が一致しないためAI評価結果を保存できません');
    }

    dto.evaluations.forEach((item) => {
      const existingIndex = this.evaluations.findIndex(
        (evaluation) =>
          evaluation.tenantId === user.tenantId && evaluation.callRecordId === item.callRecordId,
      );

      const baseId =
        existingIndex >= 0
          ? this.evaluations[existingIndex].id
          : `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const evaluation: CallingAiEvaluation = {
        id: baseId,
        tenantId: user.tenantId,
        callRecordId: item.callRecordId,
        zoomCallLogId: item.zoomCallLogId,
        evaluatedAt: item.evaluatedAt,
        categoryScores: item.categoryScores.map((score) => ({
          category: score.category,
          score: score.score,
          tagCount: score.tagCount,
          tags: score.tags.map((tag) => ({
            tag: tag.tag,
            value: tag.value,
          })),
        })),
        summary: item.summary,
        improvementPoints: item.improvementPoints,
      };

      if (existingIndex >= 0) {
        this.evaluations[existingIndex] = evaluation;
      } else {
        this.evaluations.push(evaluation);
      }
    });
  };

  /**
   * テナント単位でAI評価一覧を取得
   */
  getEvaluationsByTenant = (tenantId: string): CallingAiEvaluation[] => {
    return this.evaluations.filter((evaluation) => evaluation.tenantId === tenantId);
  };
}

