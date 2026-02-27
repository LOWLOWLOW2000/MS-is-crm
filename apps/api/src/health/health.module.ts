import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * ヘルスチェック用モジュール。
 * GET /health のみ提供。あとから変更しにくい安定モジュール。
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
