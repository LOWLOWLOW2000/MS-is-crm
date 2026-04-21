import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
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
import { normalizeCallingResult, type CallingResultType } from './calling-result-canonical';
import { isConnectedResult } from './calling-result-helpers';
import { CallingRecord } from './entities/calling-record.entity';
import { externalMapping } from './external-mapping-utils'
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExternalCallLogDto } from './dto/create-external-call-log.dto'
import { CreateCallingSessionDto } from './dto/create-calling-session.dto'
import crypto from 'node:crypto'

const HELP_STATUS_ORDER = { waiting: 0, joined: 1, closed: 2 } as const;

const REPORTING_FORMAT_KINDS = ['common_header', 'appointment', 'material_request'] as const;
type ReportingFormatKind = (typeof REPORTING_FORMAT_KINDS)[number];

/** リスト明細の進捗を「除外」に寄せる架電結果（★架電ルーム正規名） */
const LIST_ITEM_EXCLUDED_RESULTS: ReadonlySet<CallingResultType> = new Set([
  '担当NG',
  '受付NG',
  'クレーム',
  '番号違い',
])

@Injectable()
export class CallingService {
  constructor(private readonly prisma: PrismaService) {}

  private safeJsonObject = (v: unknown): Record<string, unknown> | null =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

  /**
   * 半自動架電: セッション開始（当時の公開 pack を埋め込む）。
   */
  createSession = async (
    user: JwtPayload,
    dto: CreateCallingSessionDto,
  ): Promise<{
    id: string
    tenantId: string
    status: string
    startedAt: string
    endedAt: string | null
    scriptSnapshotJson: Record<string, unknown> | null
    dictionarySnapshotJson: Record<string, unknown> | null
    voiceSnapshotJson: Record<string, unknown> | null
    createdAt: string
    updatedAt: string
  }> => {
    const [tenant] = await this.prisma.$queryRaw<
      Array<{
        id: string
        callingScriptSnapshotId: string | null
        callingDictionarySnapshotId: string | null
        callingVoiceSnapshotId: string | null
      }>
    >(Prisma.sql`
      SELECT
        "id",
        "callingScriptSnapshotId",
        "callingDictionarySnapshotId",
        "callingVoiceSnapshotId"
      FROM "tenants"
      WHERE "id" = ${user.tenantId}
      LIMIT 1
    `)
    if (!tenant) throw new BadRequestException('テナントが見つかりません')

    const ids = [
      tenant.callingScriptSnapshotId,
      tenant.callingDictionarySnapshotId,
      tenant.callingVoiceSnapshotId,
    ].filter((x): x is string => Boolean(x))

    const snapshots =
      ids.length === 0
        ? []
        : await this.prisma.$queryRaw<
            Array<{
              id: string
              kind: string
              bodyJson: unknown
            }>
          >(Prisma.sql`
            SELECT
              "id",
              "kind",
              "body_json" AS "bodyJson"
            FROM "calling_pack_snapshots"
            WHERE "tenantId" = ${user.tenantId}
              AND "id" IN (${Prisma.join(ids)})
          `)

    const byId = new Map(snapshots.map((s) => [s.id, s]))
    const script = tenant.callingScriptSnapshotId ? byId.get(tenant.callingScriptSnapshotId)?.bodyJson : null
    const dictionary = tenant.callingDictionarySnapshotId
      ? byId.get(tenant.callingDictionarySnapshotId)?.bodyJson
      : null
    const voice = tenant.callingVoiceSnapshotId ? byId.get(tenant.callingVoiceSnapshotId)?.bodyJson : null

    const now = new Date().toISOString()
    const startedAt = dto.startedAt?.trim() ? dto.startedAt : now
    const id = crypto.randomUUID()

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "calling_sessions" (
        "id",
        "tenantId",
        "createdBy",
        "status",
        "startedAt",
        "endedAt",
        "script_snapshot_json",
        "dictionary_snapshot_json",
        "voice_snapshot_json",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${id},
        ${user.tenantId},
        ${user.sub},
        ${'active'},
        ${startedAt},
        ${null},
        ${(script ?? {}) as Prisma.InputJsonValue}::jsonb,
        ${(dictionary ?? {}) as Prisma.InputJsonValue}::jsonb,
        ${(voice ?? {}) as Prisma.InputJsonValue}::jsonb,
        ${now},
        ${now}
      )
    `)

    return {
      id,
      tenantId: user.tenantId,
      status: 'active',
      startedAt,
      endedAt: null,
      scriptSnapshotJson: this.safeJsonObject(script),
      dictionarySnapshotJson: this.safeJsonObject(dictionary),
      voiceSnapshotJson: this.safeJsonObject(voice),
      createdAt: now,
      updatedAt: now,
    }
  }

  computeClientRowId = (companyNameRaw: string, phoneRaw: string): {
    companyNameNorm: string
    phoneNorm: string
    clientRowId: string
  } => {
    const companyNameNorm = externalMapping.normalizeCompanyName(companyNameRaw)
    const phoneNorm = externalMapping.normalizePhone(phoneRaw)
    const clientRowId = externalMapping.createClientRowId(companyNameNorm, phoneNorm)
    return { companyNameNorm, phoneNorm, clientRowId }
  }

  createExternalCallLog = async (
    user: JwtPayload,
    dto: CreateExternalCallLogDto,
  ): Promise<{ callingRecord: CallingRecord; listItemId: string }> => {
    const listItemId = dto.listItemId.trim()
    if (!listItemId) throw new BadRequestException('listItemId is required')

    const structuredReport: Record<string, unknown> = {
      ...(dto.structuredReport ?? {}),
      externalSync: {
        clientRowId: dto.clientRowId,
        clientRowNo: dto.clientRowNo ?? null,
        clientSourceName: dto.clientSourceName ?? null,
        recordingUrl: dto.recordingUrl ?? null,
        recordingLocalPath: dto.recordingLocalPath ?? null,
        transcriptUrl: dto.transcriptUrl ?? null,
        transcriptLocalPath: dto.transcriptLocalPath ?? null,
        containsPII: dto.containsPII ?? null,
        trainingEligible: dto.trainingEligible ?? null,
      },
    }

    const callingRecord = await this.saveRecord(user, {
      companyName: dto.companyName,
      companyPhone: dto.companyPhone,
      companyAddress: dto.companyAddress,
      targetUrl: dto.targetUrl,
      approved: true,
      result: dto.result,
      listItemId,
      memo: dto.memo ?? '',
      structuredReport,
      nextCallAt: dto.nextCallAt,
    })

    if (dto.transcriptionText?.trim()) {
      await this.createTranscription(user, {
        callRecordId: callingRecord.callingHistoryId,
        transcriptionText: dto.transcriptionText,
        transcribedAt: dto.transcribedAt,
      })
    }

    return { callingRecord, listItemId }
  }

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
    structuredReport: unknown;
    nextCallAt: string | null;
    resultCapturedAt: string;
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
    result: normalizeCallingResult(row.result),
    memo: row.memo,
    structuredReport:
      row.structuredReport !== null &&
      typeof row.structuredReport === 'object' &&
      !Array.isArray(row.structuredReport)
        ? (row.structuredReport as Record<string, unknown>)
        : null,
    nextCallAt: row.nextCallAt,
    resultCapturedAt: row.resultCapturedAt,
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
        structuredReport:
          dto.structuredReport !== undefined
            ? (dto.structuredReport as Prisma.InputJsonValue)
            : undefined,
        nextCallAt: dto.nextCallAt ?? null,
        resultCapturedAt: now,
        updatedAt: now,
      },
    });

    const listItemId = dto.listItemId?.trim()
    if (listItemId) {
      const excluded = LIST_ITEM_EXCLUDED_RESULTS.has(dto.result)
      await this.prisma.listItem.updateMany({
        where: { id: listItemId, tenantId: user.tenantId },
        data: {
          callingResult: dto.result,
          status: excluded ? 'excluded' : 'done',
          statusUpdatedAt: now,
          completedAt: excluded ? null : now,
        },
      })
    }

    return this.toRecord(row);
  };

  getSummary = async (user: JwtPayload): Promise<CallingSummaryDto> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();

    const todayRecords = await this.prisma.callingRecord.findMany({
      where: { tenantId: user.tenantId, resultCapturedAt: { gte: todayStart } },
    });

    const connectedCount = todayRecords.filter((r) => isConnectedResult(r.result)).length;

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
      orderBy: { resultCapturedAt: 'desc' },
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

  /**
   * IS 向け: ログインユーザーが作成したアポ / 資料送付の架電記録のみ（テナント内）
   */
  getMyAppointmentMaterialRecords = async (
    user: JwtPayload,
    type?: 'appointment' | 'material',
  ): Promise<
    {
      id: string
      type: 'appointment' | 'material'
      resultCapturedAt: string
      companyName: string
      targetUrl: string
      memo: string
      createdByUserId: string
      createdByName?: string
      isRead: boolean
      directorReadAt: string | null
    }[]
  > => {
    const results =
      type === 'appointment' ? (['アポ'] as const) : type === 'material' ? (['資料送付'] as const) : (['アポ', '資料送付'] as const)

    const rows = await this.prisma.callingRecord.findMany({
      where: {
        tenantId: user.tenantId,
        createdBy: user.sub,
        result: { in: [...results] },
      },
      orderBy: { resultCapturedAt: 'desc' },
      take: 200,
      select: {
        callingHistoryId: true,
        resultCapturedAt: true,
        companyName: true,
        targetUrl: true,
        memo: true,
        createdBy: true,
        result: true,
        directorReadAt: true,
      },
    })

    const selfRow = await this.prisma.user.findFirst({
      where: { id: user.sub, tenantId: user.tenantId },
      select: { name: true },
    })
    const selfName = selfRow?.name

    return rows.map((r) => ({
      id: r.callingHistoryId,
      type: r.result === 'アポ' ? ('appointment' as const) : ('material' as const),
      resultCapturedAt: r.resultCapturedAt,
      companyName: r.companyName,
      targetUrl: r.targetUrl,
      memo: r.memo,
      createdByUserId: r.createdBy,
      createdByName: selfName,
      isRead: true,
      directorReadAt: r.directorReadAt,
    }))
  }

  /** IS 向け: 自分のアポ・資料送付件数（フィルタ用ステ表示） */
  getMyAppointmentMaterialSummary = async (user: JwtPayload): Promise<{
    total: number
    appointment: number
    material: number
  }> => {
    const base = { tenantId: user.tenantId, createdBy: user.sub }
    const [appointment, material] = await Promise.all([
      this.prisma.callingRecord.count({ where: { ...base, result: 'アポ' } }),
      this.prisma.callingRecord.count({ where: { ...base, result: '資料送付' } }),
    ])
    return { total: appointment + material, appointment, material }
  }

  private defaultSchemaJsonForKind = (kind: ReportingFormatKind): Record<string, unknown> => {
    if (kind === 'appointment') {
      return {
        fields: [
          { id: 'meetingAt', label: '面談日時', type: 'text', required: false },
          { id: 'meetingPlace', label: '場所', type: 'text', required: false },
        ],
      };
    }
    if (kind === 'material_request') {
      return {
        fields: [
          { id: 'deliveryMethod', label: '送付方法', type: 'text', required: false },
          { id: 'materialName', label: '資料名', type: 'text', required: false },
        ],
      };
    }
    return {
      fields: [{ id: 'caseNote', label: '案件メモ（共通）', type: 'textarea', required: false }],
    };
  };

  ensureReportingFormatsForTenant = async (tenantId: string, actorUserId: string): Promise<void> => {
    const now = new Date().toISOString();
    for (const kind of REPORTING_FORMAT_KINDS) {
      const ex = await this.prisma.reportingFormatDefinition.findUnique({
        where: { tenantId_kind: { tenantId, kind } },
      });
      if (ex) continue;
      await this.prisma.reportingFormatDefinition.create({
        data: {
          tenantId,
          kind,
          schemaJson: this.defaultSchemaJsonForKind(kind) as Prisma.InputJsonValue,
          updatedBy: actorUserId,
          updatedAt: now,
        },
      });
    }
  };

  getReportingFormats = async (
    user: JwtPayload,
  ): Promise<{ kind: string; schemaJson: Record<string, unknown> }[]> => {
    await this.ensureReportingFormatsForTenant(user.tenantId, user.sub);
    const rows = await this.prisma.reportingFormatDefinition.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { kind: 'asc' },
    });
    return rows.map((r) => ({
      kind: r.kind,
      schemaJson:
        r.schemaJson !== null && typeof r.schemaJson === 'object' && !Array.isArray(r.schemaJson)
          ? (r.schemaJson as Record<string, unknown>)
          : {},
    }));
  };

  upsertReportingFormat = async (
    user: JwtPayload,
    kind: string,
    schemaJson: Record<string, unknown>,
  ): Promise<{ kind: string; schemaJson: Record<string, unknown> }> => {
    if (!(REPORTING_FORMAT_KINDS as readonly string[]).includes(kind)) {
      throw new BadRequestException('不明なフォーマット種別です');
    }
    const now = new Date().toISOString();
    const row = await this.prisma.reportingFormatDefinition.upsert({
      where: { tenantId_kind: { tenantId: user.tenantId, kind } },
      create: {
        tenantId: user.tenantId,
        kind,
        schemaJson: schemaJson as Prisma.InputJsonValue,
        updatedBy: user.sub,
        updatedAt: now,
      },
      update: { schemaJson: schemaJson as Prisma.InputJsonValue, updatedBy: user.sub, updatedAt: now },
    });
    return {
      kind: row.kind,
      schemaJson:
        row.schemaJson !== null && typeof row.schemaJson === 'object' && !Array.isArray(row.schemaJson)
          ? (row.schemaJson as Record<string, unknown>)
          : {},
    };
  };

  getListItemDirectorNote = async (
    user: JwtPayload,
    listItemId: string,
  ): Promise<{ listItemId: string; bodyMarkdown: string; updatedAt: string }> => {
    const item = await this.prisma.listItem.findFirst({
      where: { id: listItemId, tenantId: user.tenantId },
    });
    if (!item) {
      throw new NotFoundException('リスト明細が見つかりません');
    }
    const note = await this.prisma.listItemDirectorNote.findUnique({
      where: { listItemId },
    });
    if (!note) {
      return { listItemId, bodyMarkdown: '', updatedAt: '' };
    }
    return { listItemId, bodyMarkdown: note.bodyMarkdown, updatedAt: note.updatedAt };
  };

  upsertListItemDirectorNote = async (
    user: JwtPayload,
    listItemId: string,
    bodyMarkdown: string,
  ): Promise<{ listItemId: string; bodyMarkdown: string; updatedAt: string }> => {
    const item = await this.prisma.listItem.findFirst({
      where: { id: listItemId, tenantId: user.tenantId },
    });
    if (!item) {
      throw new NotFoundException('リスト明細が見つかりません');
    }
    const now = new Date().toISOString();
    const row = await this.prisma.listItemDirectorNote.upsert({
      where: { listItemId },
      create: {
        tenantId: user.tenantId,
        listItemId,
        bodyMarkdown,
        updatedBy: user.sub,
        updatedAt: now,
      },
      update: { bodyMarkdown, updatedBy: user.sub, updatedAt: now },
    });
    return { listItemId: row.listItemId, bodyMarkdown: row.bodyMarkdown, updatedAt: row.updatedAt };
  };

  exportCallingRecords = async (
    user: JwtPayload,
    opts: { format: 'csv' | 'xlsx' | 'pdf'; from?: string; to?: string; scope: 'self' | 'tenant' },
  ): Promise<{ buffer: Buffer; filename: string; mime: string }> => {
    if (opts.format === 'pdf') {
      throw new BadRequestException('PDF は未対応です。CSV または Excel をご利用ください');
    }
    const where: {
      tenantId: string;
      createdBy?: string;
      resultCapturedAt?: { gte?: string; lte?: string };
    } = { tenantId: user.tenantId };
    if (opts.scope === 'self') {
      where.createdBy = user.sub;
    }
    if (opts.from || opts.to) {
      where.resultCapturedAt = {};
      if (opts.from) where.resultCapturedAt.gte = opts.from;
      if (opts.to) where.resultCapturedAt.lte = opts.to;
    }
    const rows = await this.prisma.callingRecord.findMany({
      where,
      orderBy: { resultCapturedAt: 'desc' },
      take: 5000,
    });
    const flat = rows.map((r) => ({
      id: r.callingHistoryId,
      companyName: r.companyName,
      result: r.result,
      memo: r.memo,
      resultCapturedAt: r.resultCapturedAt,
      structuredReport:
        r.structuredReport === null || r.structuredReport === undefined
          ? ''
          : JSON.stringify(r.structuredReport),
      createdBy: r.createdBy,
    }));
    if (opts.format === 'csv') {
      const headers = ['id', 'companyName', 'result', 'memo', 'resultCapturedAt', 'structuredReport', 'createdBy'];
      const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const lines = [
        headers.join(','),
        ...flat.map((row) =>
          headers.map((h) => escape(String((row as Record<string, string>)[h] ?? ''))).join(','),
        ),
      ];
      const body = `\ufeff${lines.join('\n')}`;
      return {
        buffer: Buffer.from(body, 'utf8'),
        filename: 'calling-records.csv',
        mime: 'text/csv; charset=utf-8',
      };
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('CallingRecords');
    ws.columns = [
      { header: 'id', key: 'id', width: 28 },
      { header: 'companyName', key: 'companyName', width: 28 },
      { header: 'result', key: 'result', width: 14 },
      { header: 'memo', key: 'memo', width: 40 },
      { header: 'resultCapturedAt', key: 'resultCapturedAt', width: 24 },
      { header: 'structuredReport', key: 'structuredReport', width: 40 },
      { header: 'createdBy', key: 'createdBy', width: 28 },
    ];
    flat.forEach((r) => ws.addRow(r));
    const buf = await wb.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buf as ArrayBuffer),
      filename: 'calling-records.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  };
}
