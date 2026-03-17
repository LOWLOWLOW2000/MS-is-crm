import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateListReviewCompletionDto } from './dto/create-list-review-completion.dto'
import { CreateHelpRequestDto } from './dto/create-help-request.dto';
import { CreateCallingRecordDto } from './dto/create-calling-record.dto';
import { CreateTranscriptionDto } from './dto/create-transcription.dto';
import { DialValidationResultDto } from './dto/dial-validation-result.dto';
import { ValidateDialDto } from './dto/validate-dial.dto';
import { ListReviewCompletion } from './entities/list-review-completion.entity'
import { CallingHelpRequest } from './entities/calling-help-request.entity';
import { CallingSummaryDto } from './dto/calling-summary.dto';
import { CallingRecord } from './entities/calling-record.entity';
import { PrismaService } from '../prisma/prisma.service';

const HELP_STATUS_ORDER = { waiting: 0, joined: 1, closed: 2 } as const;

@Injectable()
export class CallingService {
  constructor(private readonly prisma: PrismaService) {}

  /** 完了から24時間経過した呼出を削除（tenant_id 必須） */
  private cleanupOldClosedRequests = async (tenantId: string): Promise<void> => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await this.prisma.callingHelpRequest.deleteMany({
      where: { tenantId, status: 'closed', resolvedAt: { lt: cutoff } },
    });
  };

  /** 待機キュー番号を再採番 */
  private reindexWaitingQueue = async (tenantId: string): Promise<void> => {
    const waiting = await this.prisma.callingHelpRequest.findMany({
      where: { tenantId, status: 'waiting' },
      orderBy: { requestedAt: 'asc' },
    });
    for (let i = 0; i < waiting.length; i++) {
      await this.prisma.callingHelpRequest.update({
        where: { id: waiting[i].id },
        data: { queueNumber: i + 1 },
      });
    }
    const notWaiting = await this.prisma.callingHelpRequest.findMany({
      where: { tenantId, status: { not: 'waiting' } },
    });
    for (const r of notWaiting) {
      await this.prisma.callingHelpRequest.update({
        where: { id: r.id },
        data: { queueNumber: 0 },
      });
    }
  };

  private toListReviewCompletion = (row: {
    id: string
    tenantId: string
    completedBy: string
    reviewCompletedAt: string
    targetUrl: string
    companyName: string
  }): ListReviewCompletion => ({
    id: row.id,
    tenantId: row.tenantId,
    completedBy: row.completedBy,
    reviewCompletedAt: row.reviewCompletedAt,
    targetUrl: row.targetUrl,
    companyName: row.companyName,
  })

  private toHelpRequest = (row: {
    id: string;
    tenantId: string;
    requestedBy: string;
    requestedByEmail: string;
    companyName: string;
    scriptTab: string;
    requestedAt: string;
    queueNumber: number;
    status: string;
    joinedBy: string | null;
    joinedAt: string | null;
    resolvedAt: string | null;
  }): CallingHelpRequest => ({
    id: row.id,
    tenantId: row.tenantId,
    requestedBy: row.requestedBy,
    requestedByEmail: row.requestedByEmail,
    companyName: row.companyName,
    scriptTab: row.scriptTab,
    requestedAt: row.requestedAt,
    queueNumber: row.queueNumber,
    status: row.status as CallingHelpRequest['status'],
    joinedBy: row.joinedBy,
    joinedAt: row.joinedAt,
    resolvedAt: row.resolvedAt,
  });

  private toRecord = (row: {
    callingHistoryId: string;
    tenantId: string;
    createdBy: string;
    companyName: string;
    companyPhone: string;
    companyAddress: string;
    targetUrl: string;
    approved: boolean;
    approvedAt: string | null;
    approvedBy: string | null;
    result: string;
    memo: string;
    nextCallAt: string | null;
    createdAt: string;
    updatedAt: string;
  }): CallingRecord => ({
    callingHistoryId: row.callingHistoryId,
    tenantId: row.tenantId,
    createdBy: row.createdBy,
    companyName: row.companyName,
    companyPhone: row.companyPhone,
    companyAddress: row.companyAddress,
    targetUrl: row.targetUrl,
    approved: row.approved,
    approvedAt: row.approvedAt,
    approvedBy: row.approvedBy,
    result: row.result as CallingRecord['result'],
    memo: row.memo,
    nextCallAt: row.nextCallAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  createListReviewCompletion = async (
    user: JwtPayload,
    dto: CreateListReviewCompletionDto,
  ): Promise<ListReviewCompletion> => {
    const now = new Date().toISOString()
    const row = await this.prisma.listReviewCompletion.create({
      data: {
        tenantId: user.tenantId,
        completedBy: user.sub,
        reviewCompletedAt: now,
        targetUrl: dto.targetUrl,
        companyName: dto.companyName,
      },
    })
    return this.toListReviewCompletion(row)
  }

  validateDial = async (user: JwtPayload, dto: ValidateDialDto): Promise<DialValidationResultDto> => {
    const matched = await this.prisma.listReviewCompletion.findFirst({
      where: {
        id: dto.listReviewCompletionId,
        tenantId: user.tenantId,
        targetUrl: dto.targetUrl,
      },
    })

    if (!matched) {
      return {
        canDial: false,
        reason: 'リスト精査が未完了、またはリスト精査終了情報が一致しません',
      }
    }

    return { canDial: true }
  }

  createHelpRequest = async (user: JwtPayload, dto: CreateHelpRequestDto): Promise<CallingHelpRequest> => {
    const waitingCount = await this.prisma.callingHelpRequest.count({
      where: { tenantId: user.tenantId, status: 'waiting' },
    });
    const now = new Date().toISOString();
    const row = await this.prisma.callingHelpRequest.create({
      data: {
        tenantId: user.tenantId,
        requestedBy: user.sub,
        requestedByEmail: user.email ?? '',
        companyName: dto.companyName,
        scriptTab: dto.scriptTab,
        requestedAt: now,
        queueNumber: waitingCount + 1,
        status: 'waiting',
      },
    });
    await this.reindexWaitingQueue(user.tenantId);
    return this.toHelpRequest(row);
  };

  getRecentHelpRequests = async (user: JwtPayload): Promise<CallingHelpRequest[]> => {
    await this.cleanupOldClosedRequests(user.tenantId);
    const rows = await this.prisma.callingHelpRequest.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }, { joinedAt: 'desc' }, { resolvedAt: 'desc' }],
    });
    const sorted = [...rows].sort((a, b) => {
      const oa = HELP_STATUS_ORDER[a.status as keyof typeof HELP_STATUS_ORDER] ?? 2;
      const ob = HELP_STATUS_ORDER[b.status as keyof typeof HELP_STATUS_ORDER] ?? 2;
      if (oa !== ob) return oa - ob;
      const timeA = a.resolvedAt ?? a.joinedAt ?? a.requestedAt;
      const timeB = b.resolvedAt ?? b.joinedAt ?? b.requestedAt;
      return timeB.localeCompare(timeA);
    });
    const waiting = sorted.filter((r) => r.status === 'waiting').sort((a, b) => a.queueNumber - b.queueNumber);
    const joined = sorted.filter((r) => r.status === 'joined').sort((a, b) => (b.joinedAt ?? '').localeCompare(a.joinedAt ?? ''));
    const closed = sorted.filter((r) => r.status === 'closed').sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''));
    return [...waiting, ...joined, ...closed].map((r) => this.toHelpRequest(r));
  };

  joinHelpRequest = async (user: JwtPayload, requestId: string): Promise<CallingHelpRequest> => {
    const request = await this.prisma.callingHelpRequest.findFirst({
      where: { id: requestId, tenantId: user.tenantId },
    });

    if (!request) {
      throw new NotFoundException('呼出リクエストが見つかりません');
    }

    if (request.status === 'closed') {
      throw new NotFoundException('すでに対応完了した呼出リクエストです');
    }

    const now = new Date().toISOString();
    const updated = await this.prisma.callingHelpRequest.update({
      where: { id: requestId },
      data: { status: 'joined', joinedBy: user.sub, joinedAt: now, queueNumber: 0 },
    });
    await this.reindexWaitingQueue(user.tenantId);
    return this.toHelpRequest(updated);
  };

  closeHelpRequest = async (user: JwtPayload, requestId: string): Promise<CallingHelpRequest> => {
    const request = await this.prisma.callingHelpRequest.findFirst({
      where: { id: requestId, tenantId: user.tenantId },
    });

    if (!request) {
      throw new NotFoundException('呼出リクエストが見つかりません');
    }

    const now = new Date().toISOString();
    const updated = await this.prisma.callingHelpRequest.update({
      where: { id: requestId },
      data: { status: 'closed', resolvedAt: now, queueNumber: 0 },
    });
    await this.reindexWaitingQueue(user.tenantId);
    await this.cleanupOldClosedRequests(user.tenantId);
    return this.toHelpRequest(updated);
  };

  getWaitingQueue = async (user: JwtPayload): Promise<CallingHelpRequest[]> => {
    const rows = await this.prisma.callingHelpRequest.findMany({
      where: { tenantId: user.tenantId, status: 'waiting' },
      orderBy: { queueNumber: 'asc' },
    });
    return rows.map((r) => this.toHelpRequest(r));
  };

  saveRecord = async (user: JwtPayload, dto: CreateCallingRecordDto): Promise<CallingRecord> => {
    const now = new Date().toISOString();
    const row = await this.prisma.callingRecord.create({
      data: {
        tenantId: user.tenantId,
        createdBy: user.sub,
        companyName: dto.companyName,
        companyPhone: dto.companyPhone,
        companyAddress: dto.companyAddress,
        targetUrl: dto.targetUrl,
        approved: dto.approved,
        approvedAt: dto.approved ? (dto.approvedAt ?? now) : null,
        approvedBy: dto.approved ? user.sub : null,
        result: dto.result,
        memo: dto.memo ?? '',
        nextCallAt: dto.nextCallAt ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.toRecord(row);
  };

  getSummary = async (user: JwtPayload): Promise<CallingSummaryDto> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();

    const todayRecords = await this.prisma.callingRecord.findMany({
      where: { tenantId: user.tenantId, createdAt: { gte: todayStart } },
    });

    const connectedCount = todayRecords.filter(
      (r) => r.result === '担当者あり興味' || r.result === '担当者あり不要',
    ).length;

    const now = new Date().toISOString();
    const recallScheduledCount = await this.prisma.callingRecord.count({
      where: { tenantId: user.tenantId, nextCallAt: { not: null, gt: now } },
    });

    return {
      totalCallsToday: todayRecords.length,
      connectedRate: todayRecords.length === 0 ? 0 : Math.round((connectedCount / todayRecords.length) * 100),
      recallScheduledCount,
    };
  };

  getTenantRecords = async (tenantId: string): Promise<CallingRecord[]> => {
    const rows = await this.prisma.callingRecord.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toRecord(r));
  };

  getRecallList = async (user: JwtPayload): Promise<CallingRecord[]> => {
    const now = new Date().toISOString();
    const rows = await this.prisma.callingRecord.findMany({
      where: { tenantId: user.tenantId, nextCallAt: { not: null, gt: now } },
      orderBy: { nextCallAt: 'asc' },
    });
    return rows.map((r) => this.toRecord(r));
  };

  /** Phase2: バッチが文字起こし結果を保存。callRecordId は架電履歴ID（同一 tenant の既存レコード） */
  createTranscription = async (user: JwtPayload, dto: CreateTranscriptionDto): Promise<{ id: string }> => {
    const record = await this.prisma.callingRecord.findFirst({
      where: { callingHistoryId: dto.callRecordId, tenantId: user.tenantId },
    });
    if (!record) {
      throw new NotFoundException('対象の架電記録が見つかりません');
    }
    const now = new Date().toISOString();
    const transcribedAt = dto.transcribedAt?.trim() ? dto.transcribedAt : now;
    const row = await this.prisma.callTranscription.create({
      data: {
        tenantId: user.tenantId,
        callRecordId: dto.callRecordId,
        zoomMeetingId: dto.zoomMeetingId?.trim() || null,
        recordingStorageUrl: dto.recordingStorageUrl?.trim() || null,
        durationSeconds: dto.durationSeconds ?? null,
        transcribedAt,
        transcriptionText: dto.transcriptionText ?? '',
        createdAt: now,
      },
    });
    return { id: row.id };
  };

  getTranscriptionByRecordId = async (user: JwtPayload, callRecordId: string): Promise<{
    id: string;
    callRecordId: string;
    transcriptionText: string;
    transcribedAt: string;
    durationSeconds: number | null;
  } | null> => {
    const record = await this.prisma.callingRecord.findFirst({
      where: { callingHistoryId: callRecordId, tenantId: user.tenantId },
    });
    if (!record) {
      return null;
    }
    const row = await this.prisma.callTranscription.findFirst({
      where: { callRecordId, tenantId: user.tenantId },
      orderBy: { transcribedAt: 'desc' },
    });
    if (!row) return null;
    return {
      id: row.id,
      callRecordId: row.callRecordId,
      transcriptionText: row.transcriptionText,
      transcribedAt: row.transcribedAt,
      durationSeconds: row.durationSeconds,
    };
  };
}
