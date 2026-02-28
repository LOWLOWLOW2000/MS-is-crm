import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AiService } from './ai.service';
import { BatchCallEvaluationsDto } from './dto/batch-evaluations.dto';
import { BatchTranscriptionsDto } from './dto/batch-transcriptions.dto';

interface JwtRequest extends Request {
  user: JwtPayload;
}

/**
 * AI評価・文字起こしバッチ用API（Phase2）。
 * バッチ処理（apps/ai）から JWT 付きで呼び出し、DB に保存する。
 */
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * 通話評価結果の一括登録（Phase2: DB永続化）
   */
  @Post('call-evaluations/batch')
  @HttpCode(HttpStatus.NO_CONTENT)
  async postCallEvaluationsBatch(
    @Req() req: JwtRequest,
    @Body() dto: BatchCallEvaluationsDto,
  ): Promise<void> {
    await this.aiService.saveBatchEvaluations(req.user, dto);
  }

  /**
   * 文字起こし結果の一括登録（Phase2: Whisper バッチ → DB）
   */
  @Post('transcriptions/batch')
  @HttpCode(HttpStatus.NO_CONTENT)
  async postTranscriptionsBatch(
    @Req() req: JwtRequest,
    @Body() dto: BatchTranscriptionsDto,
  ): Promise<void> {
    await this.aiService.saveBatchTranscriptions(req.user, dto);
  }
}
