import { Controller, Get } from '@nestjs/common';

/**
 * ヘルスチェック用コントローラ。
 * LB・k8s の存活確認用。仕様変更の可能性は低い。
 */
@Controller('health')
export class HealthController {
  @Get()
  getHealth(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
