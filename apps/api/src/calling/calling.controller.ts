import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { hasAnyRole } from '../common/auth/role-utils';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import {
  ALL_CALLING_RESULTS,
  CALLING_RESULTS_EXCEPT_ABSENT,
  VOICEMAIL_UNREACHABLE_ANSWERED_THRESHOLD,
} from './calling-result-rules';
import { CallingService } from './calling.service';
import { CreateListReviewCompletionDto } from './dto/create-list-review-completion.dto'
import { CreateHelpRequestDto } from './dto/create-help-request.dto';
import { CreateCallingRecordDto } from './dto/create-calling-record.dto';
import { UpsertListItemDirectorNoteDto } from './dto/upsert-list-item-director-note.dto';
import { UpsertReportingFormatBodyDto } from './dto/upsert-reporting-format-body.dto';
import { CreateTranscriptionDto } from './dto/create-transcription.dto';
import { DialValidationResultDto } from './dto/dial-validation-result.dto';
import { ValidateDialDto } from './dto/validate-dial.dto';
import { ListReviewCompletion } from './entities/list-review-completion.entity'
import { CallingHelpRequest } from './entities/calling-help-request.entity';
import { CallingSummaryDto } from './dto/calling-summary.dto';
import { CallingRecord } from './entities/calling-record.entity';
import { CreateExternalCallLogDto } from './dto/create-external-call-log.dto'

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
    if (!hasAnyRole(user, [UserRole.Developer, UserRole.IsAdmin])) {
      throw new ForbiddenException('文字起こしの保存は管理者のみ可能です');
    }
  };

  /** 参加・対応完了は director / is_admin / enterprise_admin / developer のみ */
  private assertDirectorOrAdmin = (user: JwtPayload): void => {
    const allowed = [UserRole.Director, UserRole.IsAdmin, UserRole.EnterpriseAdmin, UserRole.Developer];
    if (!hasAnyRole(user, allowed)) {
      throw new ForbiddenException('ヘルプへの参加・対応完了はディレクターまたは管理者のみ可能です');
    }
  };

  /** 自分のアポ・資料一覧（作成者スコープ）。ナビ上は IS 枠と重なるため director / enterprise_admin も許可 */
  private assertCanViewOwnAppointmentMaterial = (user: JwtPayload): void => {
    if (
      !hasAnyRole(user, [
        UserRole.IsMember,
        UserRole.IsAdmin,
        UserRole.Developer,
        UserRole.Director,
        UserRole.EnterpriseAdmin,
      ])
    ) {
      throw new ForbiddenException('この操作はログインユーザーのみ可能です');
    }
  };

  /** 架電記録エクスポート: self は IS 相当ロール、tenant はディレクター／管理者 */
  private assertCanExportCallingRecords = (user: JwtPayload, scope: 'self' | 'tenant'): void => {
    if (scope === 'self') {
      this.assertCanViewOwnAppointmentMaterial(user);
      return;
    }
    const allowed = [UserRole.Director, UserRole.IsAdmin, UserRole.EnterpriseAdmin, UserRole.Developer];
    if (!hasAnyRole(user, allowed)) {
      throw new ForbiddenException('テナント全体のエクスポートはディレクターまたは管理者のみ可能です');
    }
  };

  /** 外部リストの紐付け管理は developer / is_admin のみ */
  private assertCanManageExternalMappings = (user: JwtPayload): void => {
    if (!hasAnyRole(user, [UserRole.Developer, UserRole.IsAdmin])) {
      throw new ForbiddenException('外部リスト紐付けの操作は管理者のみ可能です')
    }
  }

  @Post('list-review-completions')
  async createListReviewCompletion(
    @Req() req: JwtRequest,
    @Body() dto: CreateListReviewCompletionDto,
  ): Promise<ListReviewCompletion> {
    try {
      return await this.callingService.createListReviewCompletion(req.user, dto)
    } catch (error) {
      throw new InternalServerErrorException('リスト精査終了の保存に失敗しました')
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

  @Post('external-mappings/compute-client-row-id')
  computeClientRowId(
    @Req() req: JwtRequest,
    @Body() body: { companyName: string; companyPhone: string },
  ): { companyNameNorm: string; phoneNorm: string; clientRowId: string } {
    this.assertCanManageExternalMappings(req.user)
    return this.callingService.computeClientRowId(body.companyName ?? '', body.companyPhone ?? '')
  }

  @Post('external-call-logs')
  async createExternalCallLog(
    @Req() req: JwtRequest,
    @Body() dto: CreateExternalCallLogDto,
  ): Promise<{ callingRecord: CallingRecord; listItemId: string }> {
    this.assertCanManageExternalMappings(req.user)
    try {
      const { callingRecord, listItemId } = await this.callingService.createExternalCallLog(req.user, dto)
      this.notificationsGateway.scheduleRecallReminders(callingRecord)
      return { callingRecord, listItemId }
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error
      }
      throw new InternalServerErrorException('外部架電ログの保存に失敗しました')
    }
  }

  /** 架電記録の CSV / Excel エクスポート（`records/:id/...` より先に定義） */
  @Get('records/export')
  async exportCallingRecords(
    @Req() req: JwtRequest,
    @Res() res: Response,
    @Query('format') formatRaw?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('scope') scopeRaw?: string,
  ): Promise<void> {
    const format =
      formatRaw === 'xlsx' ? 'xlsx' : formatRaw === 'csv' ? 'csv' : formatRaw === 'pdf' ? 'pdf' : null;
    if (!format) {
      throw new BadRequestException('format は csv / xlsx / pdf のいずれかを指定してください');
    }
    const scope = scopeRaw === 'tenant' ? 'tenant' : 'self';
    this.assertCanExportCallingRecords(req.user, scope);
    try {
      const { buffer, filename, mime } = await this.callingService.exportCallingRecords(req.user, {
        format,
        from,
        to,
        scope,
      });
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.send(buffer);
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('架電記録のエクスポートに失敗しました');
    }
  }

  @Get('reporting-formats')
  async getReportingFormats(
    @Req() req: JwtRequest,
  ): Promise<{ kind: string; schemaJson: Record<string, unknown> }[]> {
    this.assertCanViewOwnAppointmentMaterial(req.user);
    try {
      return await this.callingService.getReportingFormats(req.user);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('報告フォーマットの取得に失敗しました');
    }
  }

  @Put('reporting-formats/:kind')
  async putReportingFormat(
    @Req() req: JwtRequest,
    @Param('kind') kind: string,
    @Body() dto: UpsertReportingFormatBodyDto,
  ): Promise<{ kind: string; schemaJson: Record<string, unknown> }> {
    this.assertDirectorOrAdmin(req.user);
    try {
      return await this.callingService.upsertReportingFormat(req.user, kind, dto.schemaJson);
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('報告フォーマットの保存に失敗しました');
    }
  }

  @Get('list-items/:listItemId/director-note')
  async getListItemDirectorNote(
    @Req() req: JwtRequest,
    @Param('listItemId') listItemId: string,
  ): Promise<{ listItemId: string; bodyMarkdown: string; updatedAt: string }> {
    this.assertCanViewOwnAppointmentMaterial(req.user);
    try {
      return await this.callingService.getListItemDirectorNote(req.user, listItemId);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ディレクターノートの取得に失敗しました');
    }
  }

  @Put('list-items/:listItemId/director-note')
  async putListItemDirectorNote(
    @Req() req: JwtRequest,
    @Param('listItemId') listItemId: string,
    @Body() dto: UpsertListItemDirectorNoteDto,
  ): Promise<{ listItemId: string; bodyMarkdown: string; updatedAt: string }> {
    this.assertDirectorOrAdmin(req.user);
    try {
      return await this.callingService.upsertListItemDirectorNote(req.user, listItemId, dto.bodyMarkdown);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('ディレクターノートの保存に失敗しました');
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

  /** IS 向け: 自分のアポ・資料送付の件数サマリ */
  @Get('my-appointment-material/summary')
  async getMyAppointmentMaterialSummary(
    @Req() req: JwtRequest,
  ): Promise<{ total: number; appointment: number; material: number }> {
    this.assertCanViewOwnAppointmentMaterial(req.user);
    try {
      return await this.callingService.getMyAppointmentMaterialSummary(req.user);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('アポ・資料サマリの取得に失敗しました');
    }
  }

  /** IS 向け: 自分のアポ・資料送付の一覧（任意 query type=appointment|material） */
  @Get('my-appointment-material')
  async getMyAppointmentMaterial(
    @Req() req: JwtRequest,
    @Query('type') typeRaw?: string,
  ): Promise<
    {
      id: string;
      type: 'appointment' | 'material';
      resultCapturedAt: string;
      companyName: string;
      targetUrl: string;
      memo: string;
      createdByUserId: string;
      createdByName?: string;
      isRead: boolean;
      directorReadAt: string | null;
    }[]
  > {
    this.assertCanViewOwnAppointmentMaterial(req.user);
    const type =
      typeRaw === 'appointment' ? 'appointment' : typeRaw === 'material' ? 'material' : undefined;
    try {
      return await this.callingService.getMyAppointmentMaterialRecords(req.user, type);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('アポ・資料一覧の取得に失敗しました');
    }
  }

  /** KPI/画面用: 結果フラグ集合と未着電ルール閾値 */
  @Get('result-rules')
  getResultRules(): {
    allResults: readonly string[];
    exceptAbsent: readonly string[];
    voicemailUnreachableAnsweredThreshold: number;
  } {
    return {
      allResults: ALL_CALLING_RESULTS,
      exceptAbsent: CALLING_RESULTS_EXCEPT_ABSENT,
      voicemailUnreachableAnsweredThreshold: VOICEMAIL_UNREACHABLE_ANSWERED_THRESHOLD,
    };
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
