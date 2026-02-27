import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { BatchCallEvaluationsDto } from './dto/batch-evaluations.dto';

interface JwtRequest extends Request {
  user: JwtPayload;
}

/**
 * AI評価バッチ用API（Phase2で実装予定）。
 * 現時点では受け口のみ。バッチ処理は apps/ai/batch から本実装時に呼び出す。
 */
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  /**
   * 通話評価結果の一括登録（Phase2で実装。現状は204のみ返却）
   */
  @Post('call-evaluations/batch')
  @HttpCode(HttpStatus.NO_CONTENT)
  postCallEvaluationsBatch(
    @Req() _req: JwtRequest,
    @Body() _dto: BatchCallEvaluationsDto,
  ): void {
    // Phase2: ここでDBに保存。現状は何もしない
  }
}
