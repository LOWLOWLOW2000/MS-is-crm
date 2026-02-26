import { Injectable } from '@nestjs/common';
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
    const queueNumber =
      this.helpRequests.filter((request) => request.tenantId === user.tenantId).length + 1;

    const request: CallingHelpRequest = {
      id: `help-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId: user.tenantId,
      requestedBy: user.sub,
      companyName: dto.companyName,
      scriptTab: dto.scriptTab,
      requestedAt: new Date().toISOString(),
      queueNumber,
    };

    this.helpRequests.push(request);
    return request;
  };

  getRecentHelpRequests = (user: JwtPayload): CallingHelpRequest[] => {
    return this.helpRequests
      .filter((request) => request.tenantId === user.tenantId)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      .slice(0, 20);
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
}

