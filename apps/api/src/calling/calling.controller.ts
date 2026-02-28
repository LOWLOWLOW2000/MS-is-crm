import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CallingService } from './calling.service';
import { CreateCallingApprovalDto } from './dto/create-calling-approval.dto';
import { CreateHelpRequestDto } from './dto/create-help-request.dto';
import { CreateCallingRecordDto } from './dto/create-calling-record.dto';
import { CreateTranscriptionDto } from './dto/create-transcription.dto';
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

  /** 文字起こし保存はバッチ用。developer / is_admin のみ */
  private assertCanSaveTranscription = (user: JwtPayload): void => {
    if (user.role !== UserRole.Developer && user.role !== UserRole.IsAdmin) {
      throw new ForbiddenException('文字起こしの保存は管理者のみ可能です');
    }
  };

  /** 参加・対応完了は director / is_admin / enterprise_admin / developer のみ */
  private assertDirectorOrAdmin = (user: JwtPayload): void => {
    const allowed = [UserRole.Director, UserRole.IsAdmin, UserRole.EnterpriseAdmin, UserRole.Developer];
    if (!allowed.includes(user.role)) {
      throw new ForbiddenException('ヘルプへの参加・対応完了はディレクターまたは管理者のみ可能です');
    }
  };

  @Post('approvals')
  async createCallingApproval(
    @Req() req: JwtRequest,
    @Body() dto: CreateCallingApprovalDto,
  ): Promise<CallingApproval> {
    try {
      return await this.callingService.createApproval(req.user, dto);
    } catch (error) {
      throw new InternalServerErrorException('承認情報の保存に失敗しました');
    }
  }

  @Post('dial-check')
  async validateDial(@Req() req: JwtRequest, @Body() dto: ValidateDialDto): Promise<DialValidationResultDto> {
    try {
      return await this.callingService.validateDial(req.user, dto);
    } catch (error) {
      throw new InternalServerErrorException('発信可否の確認に失敗しました');
    }
  }

  @Post('records')
  async createCallingRecord(@Req() req: JwtRequest, @Body() dto: CreateCallingRecordDto): Promise<CallingRecord> {
    try {
      const record = await this.callingService.saveRecord(req.user, dto);
      this.notificationsGateway.scheduleRecallReminders(record);
      return record;
    } catch (error) {
      throw new InternalServerErrorException('架電記録の保存に失敗しました');
    }
  }

  @Get('summary')
  async getCallingSummary(@Req() req: JwtRequest): Promise<CallingSummaryDto> {
    try {
      return await this.callingService.getSummary(req.user);
    } catch (error) {
      throw new InternalServerErrorException('架電サマリーの取得に失敗しました');
    }
  }

  @Get('recall')
  async getRecallList(@Req() req: JwtRequest): Promise<CallingRecord[]> {
    try {
      return await this.callingService.getRecallList(req.user);
    } catch (error) {
      throw new InternalServerErrorException('再架電一覧の取得に失敗しました');
    }
  }

  /** Phase2: バッチが文字起こし結果を保存するエンドポイント */
  @Post('transcriptions')
  async createTranscription(@Req() req: JwtRequest, @Body() dto: CreateTranscriptionDto): Promise<{ id: string }> {
    this.assertCanSaveTranscription(req.user);
    try {
      return await this.callingService.createTranscription(req.user, dto);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('文字起こしの保存に失敗しました');
    }
  }

  /** Phase2: 架電記録に紐づく文字起こしを1件取得 */
  @Get('records/:callRecordId/transcription')
  async getTranscription(
    @Req() req: JwtRequest,
    @Param('callRecordId') callRecordId: string,
  ): Promise<{ id: string; callRecordId: string; transcriptionText: string; transcribedAt: string; durationSeconds: number | null } | null> {
    try {
      return await this.callingService.getTranscriptionByRecordId(req.user, callRecordId);
    } catch {
      throw new InternalServerErrorException('文字起こしの取得に失敗しました');
    }
  }

  @Post('help-requests')
  async createHelpRequest(@Req() req: JwtRequest, @Body() dto: CreateHelpRequestDto): Promise<CallingHelpRequest> {
    try {
      const request = await this.callingService.createHelpRequest(req.user, dto);
      this.notificationsGateway.emitHelpRequested(request);
      const queue = await this.callingService.getWaitingQueue(req.user);
      this.notificationsGateway.emitQueueUpdated({ tenantId: req.user.tenantId, requests: queue });
      return request;
    } catch (error) {
      throw new InternalServerErrorException('ディレクター呼出の送信に失敗しました');
    }
  }

  @Get('help-requests/recent')
  async getRecentHelpRequests(@Req() req: JwtRequest): Promise<CallingHelpRequest[]> {
    try {
      return await this.callingService.getRecentHelpRequests(req.user);
    } catch (error) {
      throw new InternalServerErrorException('呼出履歴の取得に失敗しました');
    }
  }

  @Post('help-requests/:requestId/join')
  async joinHelpRequest(
    @Req() req: JwtRequest,
    @Param('requestId') requestId: string,
  ): Promise<CallingHelpRequest> {
    this.assertDirectorOrAdmin(req.user);
    try {
      const request = await this.callingService.joinHelpRequest(req.user, requestId);
      this.notificationsGateway.emitDirectorJoined({
        requestId: request.id,
        tenantId: request.tenantId,
        requestedBy: request.requestedBy,
        joinedBy: request.joinedBy ?? req.user.sub,
        joinedAt: request.joinedAt ?? new Date().toISOString(),
      });
      const queue = await this.callingService.getWaitingQueue(req.user);
      this.notificationsGateway.emitQueueUpdated({ tenantId: req.user.tenantId, requests: queue });
      return request;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('ディレクター参加処理に失敗しました');
    }
  }

  @Post('help-requests/:requestId/close')
  async closeHelpRequest(
    @Req() req: JwtRequest,
    @Param('requestId') requestId: string,
  ): Promise<CallingHelpRequest> {
    this.assertDirectorOrAdmin(req.user);
    try {
      const request = await this.callingService.closeHelpRequest(req.user, requestId);
      this.notificationsGateway.emitCallEnded({
        requestId: request.id,
        tenantId: request.tenantId,
        resolvedAt: request.resolvedAt ?? new Date().toISOString(),
      });
      const queue = await this.callingService.getWaitingQueue(req.user);
      this.notificationsGateway.emitQueueUpdated({ tenantId: req.user.tenantId, requests: queue });
      return request;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('呼出対応完了処理に失敗しました');
    }
  }
}
