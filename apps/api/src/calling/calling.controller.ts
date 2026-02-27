import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CallingService } from './calling.service';
import { CreateCallingApprovalDto } from './dto/create-calling-approval.dto';
import { CreateHelpRequestDto } from './dto/create-help-request.dto';
import { CreateCallingRecordDto } from './dto/create-calling-record.dto';
import { DialValidationResultDto } from './dto/dial-validation-result.dto';
import { ValidateDialDto } from './dto/validate-dial.dto';
import { CallingApproval } from './entities/calling-approval.entity';
import { CallingHelpRequest } from './entities/calling-help-request.entity';
import { CallingSummaryDto } from './dto/calling-summary.dto';
import { CallingRecord } from './entities/calling-record.entity';

interface JwtRequest extends Request {
  user: JwtPayload;
}

@Controller('calling')
@UseGuards(JwtAuthGuard)
export class CallingController {
  constructor(
    private readonly callingService: CallingService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  @Post('approvals')
  createCallingApproval(
    @Req() req: JwtRequest,
    @Body() dto: CreateCallingApprovalDto,
  ): CallingApproval {
    try {
      return this.callingService.createApproval(req.user, dto);
    } catch (error) {
      throw new InternalServerErrorException('承認情報の保存に失敗しました');
    }
  }

  @Post('dial-check')
  validateDial(@Req() req: JwtRequest, @Body() dto: ValidateDialDto): DialValidationResultDto {
    try {
      return this.callingService.validateDial(req.user, dto);
    } catch (error) {
      throw new InternalServerErrorException('発信可否の確認に失敗しました');
    }
  }

  @Post('records')
  createCallingRecord(@Req() req: JwtRequest, @Body() dto: CreateCallingRecordDto): CallingRecord {
    try {
      const record = this.callingService.saveRecord(req.user, dto);
      this.notificationsGateway.scheduleRecallReminders(record);
      return record;
    } catch (error) {
      throw new InternalServerErrorException('架電記録の保存に失敗しました');
    }
  }

  @Get('summary')
  getCallingSummary(@Req() req: JwtRequest): CallingSummaryDto {
    try {
      return this.callingService.getSummary(req.user);
    } catch (error) {
      throw new InternalServerErrorException('架電サマリーの取得に失敗しました');
    }
  }

  @Post('help-requests')
  createHelpRequest(@Req() req: JwtRequest, @Body() dto: CreateHelpRequestDto): CallingHelpRequest {
    try {
      const request = this.callingService.createHelpRequest(req.user, dto);
      this.notificationsGateway.emitHelpRequested(request);
      this.notificationsGateway.emitQueueUpdated({
        tenantId: req.user.tenantId,
        requests: this.callingService.getWaitingQueue(req.user),
      });
      return request;
    } catch (error) {
      throw new InternalServerErrorException('ディレクター呼出の送信に失敗しました');
    }
  }

  @Get('help-requests/recent')
  getRecentHelpRequests(@Req() req: JwtRequest): CallingHelpRequest[] {
    try {
      return this.callingService.getRecentHelpRequests(req.user);
    } catch (error) {
      throw new InternalServerErrorException('呼出履歴の取得に失敗しました');
    }
  }

  @Post('help-requests/:requestId/join')
  joinHelpRequest(
    @Req() req: JwtRequest,
    @Param('requestId') requestId: string,
  ): CallingHelpRequest {
    try {
      const request = this.callingService.joinHelpRequest(req.user, requestId);
      this.notificationsGateway.emitDirectorJoined({
        requestId: request.id,
        tenantId: request.tenantId,
        requestedBy: request.requestedBy,
        joinedBy: request.joinedBy ?? req.user.sub,
        joinedAt: request.joinedAt ?? new Date().toISOString(),
      });
      this.notificationsGateway.emitQueueUpdated({
        tenantId: req.user.tenantId,
        requests: this.callingService.getWaitingQueue(req.user),
      });
      return request;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('ディレクター参加処理に失敗しました');
    }
  }

  @Post('help-requests/:requestId/close')
  closeHelpRequest(
    @Req() req: JwtRequest,
    @Param('requestId') requestId: string,
  ): CallingHelpRequest {
    try {
      const request = this.callingService.closeHelpRequest(req.user, requestId);
      this.notificationsGateway.emitCallEnded({
        requestId: request.id,
        tenantId: request.tenantId,
        resolvedAt: request.resolvedAt ?? new Date().toISOString(),
      });
      this.notificationsGateway.emitQueueUpdated({
        tenantId: req.user.tenantId,
        requests: this.callingService.getWaitingQueue(req.user),
      });
      return request;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('呼出対応完了処理に失敗しました');
    }
  }
}

