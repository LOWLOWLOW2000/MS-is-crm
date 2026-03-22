import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import type { BatchCallEvaluationsDto } from './dto/batch-evaluations.dto';
import type { BatchTranscriptionsDto } from './dto/batch-transcriptions.dto';

/**
 * Phase2: AI評価バッチ・文字起こしバッチの受け口とDB永続化
 */
@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * バッチAI評価結果をDBに保存（Phase2）
   * 同一 callRecordId は上書き（upsert）
   */
  saveBatchEvaluations = async (
    user: JwtPayload,
    dto: BatchCallEvaluationsDto,
  ): Promise<void> => {
    if (dto.tenantId !== user.tenantId) {
      throw new BadRequestException(
        'tenantId が一致しないためAI評価結果を保存できません',
      );
    }

    for (const item of dto.evaluations) {
      const existing = await this.prisma.callingAiEvaluation.findFirst({
        where: {
          tenantId: user.tenantId,
          callRecordId: item.callRecordId,
        },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.callingAiEvaluation.update({
          where: { id: existing.id },
          data: {
            evaluatedAt: item.evaluatedAt,
            categoryScores: item.categoryScores as object,
            summary: item.summary ?? null,
            improvementPoints: item.improvementPoints ?? Prisma.JsonNull,
          },
        });
      } else {
        await this.prisma.callingAiEvaluation.create({
          data: {
            tenantId: user.tenantId,
            callRecordId: item.callRecordId,
            evaluatedAt: item.evaluatedAt,
            categoryScores: item.categoryScores as object,
            summary: item.summary ?? null,
            improvementPoints: item.improvementPoints ?? Prisma.JsonNull,
          },
        });
      }
    }
  };

  /**
   * バッチ文字起こし結果をDBに保存（Phase2: Whisper 結果）
   */
  saveBatchTranscriptions = async (
    user: JwtPayload,
    dto: BatchTranscriptionsDto,
  ): Promise<void> => {
    if (dto.tenantId !== user.tenantId) {
      throw new BadRequestException(
        'tenantId が一致しないため文字起こし結果を保存できません',
      );
    }

    const now = new Date().toISOString();
    for (const item of dto.transcriptions) {
      await this.prisma.callTranscription.create({
        data: {
          tenantId: user.tenantId,
          callRecordId: item.callRecordId,
          zoomMeetingId: item.zoomMeetingId ?? null,
          recordingStorageUrl: item.recordingStorageUrl ?? null,
          durationSeconds: item.durationSeconds ?? null,
          transcribedAt: item.transcribedAt,
          transcriptionText: item.transcriptionText ?? '',
          createdAt: now,
        },
      });
    }
  };
}
