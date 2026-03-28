import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { CallWebhookEventDto } from './dto/call-webhook-event.dto';

/**
 * 外部 PBX / CTI からの通話ライフサイクル通知（最小経路）。
 * 認証は環境変数 CALL_WEBHOOK_SECRET とヘッダー x-call-webhook-secret の一致。
 */
@Controller('webhooks')
export class CallWebhooksController {
  @Post('call-events')
  handle(
    @Body() body: CallWebhookEventDto,
    @Headers('x-call-webhook-secret') secret?: string,
  ): { ok: true; event: string } {
    const expected = process.env.CALL_WEBHOOK_SECRET?.trim();
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
    return { ok: true, event: body.event };
  }
}
