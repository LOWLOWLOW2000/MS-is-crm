import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateCallingApprovalDto } from './dto/create-calling-approval.dto';
import { CreateHelpRequestDto } from './dto/create-help-request.dto';
import { CreateCallingRecordDto } from './dto/create-calling-record.dto';
import { DialValidationResultDto } from './dto/dial-validation-result.dto';
import { ValidateDialDto } from './dto/validate-dial.dto';
import { CallingApproval } from './entities/calling-approval.entity';
import { CallingHelpRequest } from './entities/calling-help-request.entity';
import { CallingSummaryDto } from './dto/calling-summary.dto';
import { CallingRecord } from './entities/calling-record.entity';

@Injectable()
export class CallingService {
  private readonly records: CallingRecord[] = [];
  private readonly approvals: CallingApproval[] = [];
  private readonly helpRequests: CallingHelpRequest[] = [];

  /** 完了から24時間経過した呼出を自動削除（メモリ節約） */
  private cleanupOldClosedRequests = (): void => {
    const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
    for (let i = this.helpRequests.length - 1; i >= 0; i--) {
      const r = this.helpRequests[i];
      if (r.status === 'closed' && r.resolvedAt) {
        if (new Date(r.resolvedAt).getTime() < cutoffMs) {
          this.helpRequests.splice(i, 1);
        }
      }
    }
  };

  private listHelpRequestsByTenant = (tenantId: string): CallingHelpRequest[] => {
    return this.helpRequests
      .filter((request) => request.tenantId === tenantId)
      .sort((a, b) => {
        // 表示順: waiting → joined → closed、同状態内は新しい順
        const order = { waiting: 0, joined: 1, closed: 2 };
        const oa = order[a.status] ?? 2;
        const ob = order[b.status] ?? 2;
        if (oa !== ob) return oa - ob;
        const timeA = a.resolvedAt ?? a.joinedAt ?? a.requestedAt;
        const timeB = b.resolvedAt ?? b.joinedAt ?? b.requestedAt;
        return timeB.localeCompare(timeA);
      });
  };

  private reindexWaitingQueue = (tenantId: string): void => {
    let queueNumber = 1;
    this.listHelpRequestsByTenant(tenantId).forEach((request) => {
      if (request.status === 'waiting') {
        request.queueNumber = queueNumber;
        queueNumber += 1;
        return;
      }

      request.queueNumber = 0;
    });
  };

  createApproval = (user: JwtPayload, dto: CreateCallingApprovalDto): CallingApproval => {
    const approval: CallingApproval = {
      id: `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId: user.tenantId,
      approvedBy: user.sub,
      approvedAt: new Date().toISOString(),
      targetUrl: dto.targetUrl,
      companyName: dto.companyName,
    };

    this.approvals.push(approval);
    return approval;
  };

  validateDial = (user: JwtPayload, dto: ValidateDialDto): DialValidationResultDto => {
    const matched = this.approvals.find((approval) => {
      return (
        approval.id === dto.approvalId &&
        approval.tenantId === user.tenantId &&
        approval.targetUrl === dto.targetUrl
      );
    });

    if (!matched) {
      return {
        canDial: false,
        reason: '承認が未完了、または承認情報が一致しません',
      };
    }

    return {
      canDial: true,
    };
  };

  createHelpRequest = (user: JwtPayload, dto: CreateHelpRequestDto): CallingHelpRequest => {
    const queueNumber = this.helpRequests.filter(
      (request) => request.tenantId === user.tenantId && request.status === 'waiting',
    ).length + 1;

    const request: CallingHelpRequest = {
      id: `help-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId: user.tenantId,
      requestedBy: user.sub,
      requestedByEmail: user.email,
      companyName: dto.companyName,
      scriptTab: dto.scriptTab,
      requestedAt: new Date().toISOString(),
      queueNumber,
      status: 'waiting',
      joinedBy: null,
      joinedAt: null,
      resolvedAt: null,
    };

    this.helpRequests.push(request);
    this.reindexWaitingQueue(user.tenantId);
    return request;
  };

  getRecentHelpRequests = (user: JwtPayload): CallingHelpRequest[] => {
    this.cleanupOldClosedRequests();
    const tenant = this.listHelpRequestsByTenant(user.tenantId);
    const waiting = tenant.filter((r) => r.status === 'waiting').sort((a, b) => a.queueNumber - b.queueNumber);
    const joined = tenant.filter((r) => r.status === 'joined').sort((a, b) => (b.joinedAt ?? '').localeCompare(a.joinedAt ?? ''));
    const closed = tenant
      .filter((r) => r.status === 'closed')
      .sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''));
    return [...waiting, ...joined, ...closed];
  };

  joinHelpRequest = (user: JwtPayload, requestId: string): CallingHelpRequest => {
    const request = this.helpRequests.find(
      (candidate) => candidate.id === requestId && candidate.tenantId === user.tenantId,
    );

    if (!request) {
      throw new NotFoundException('呼出リクエストが見つかりません');
    }

    if (request.status === 'closed') {
      throw new NotFoundException('すでに対応完了した呼出リクエストです');
    }

    request.status = 'joined';
    request.joinedBy = user.sub;
    request.joinedAt = new Date().toISOString();
    request.queueNumber = 0;
    this.reindexWaitingQueue(user.tenantId);

    return request;
  };

  closeHelpRequest = (user: JwtPayload, requestId: string): CallingHelpRequest => {
    const request = this.helpRequests.find(
      (candidate) => candidate.id === requestId && candidate.tenantId === user.tenantId,
    );

    if (!request) {
      throw new NotFoundException('呼出リクエストが見つかりません');
    }

    request.status = 'closed';
    request.queueNumber = 0;
    request.resolvedAt = new Date().toISOString();
    this.reindexWaitingQueue(user.tenantId);
    this.cleanupOldClosedRequests();
    return request;
  };

  getWaitingQueue = (user: JwtPayload): CallingHelpRequest[] => {
    return this.listHelpRequestsByTenant(user.tenantId).filter((request) => request.status === 'waiting');
  };

  saveRecord = (user: JwtPayload, dto: CreateCallingRecordDto): CallingRecord => {
    const nowIso = new Date().toISOString();
    const record: CallingRecord = {
      id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId: user.tenantId,
      createdBy: user.sub,
      companyName: dto.companyName,
      companyPhone: dto.companyPhone,
      companyAddress: dto.companyAddress,
      targetUrl: dto.targetUrl,
      approved: dto.approved,
      approvedAt: dto.approved ? (dto.approvedAt ?? nowIso) : null,
      approvedBy: dto.approved ? user.sub : null,
      result: dto.result,
      memo: dto.memo ?? '',
      nextCallAt: dto.nextCallAt ?? null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.records.push(record);
    return record;
  };

  getSummary = (user: JwtPayload): CallingSummaryDto => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const nowMs = Date.now();

    // tenant_id で絞り込んだ上で集計する
    const tenantRecords = this.records.filter((record) => record.tenantId === user.tenantId);
    const todayRecords = tenantRecords.filter((record) => {
      return new Date(record.createdAt).getTime() >= todayMs;
    });

    const connectedCount = todayRecords.filter((record) => {
      return record.result === '担当者あり興味' || record.result === '担当者あり不要';
    }).length;

    const recallScheduledCount = tenantRecords.filter((record) => {
      if (!record.nextCallAt) {
        return false;
      }
      return new Date(record.nextCallAt).getTime() > nowMs;
    }).length;

    return {
      totalCallsToday: todayRecords.length,
      connectedRate:
        todayRecords.length === 0 ? 0 : Math.round((connectedCount / todayRecords.length) * 100),
      recallScheduledCount,
    };
  };

  getTenantRecords = (tenantId: string): CallingRecord[] => {
    return this.records.filter((record) => record.tenantId === tenantId);
  };
}

