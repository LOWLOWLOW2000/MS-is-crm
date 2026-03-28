import { Module } from '@nestjs/common';
import { CallWebhooksController } from './call-webhooks.controller';

@Module({
  controllers: [CallWebhooksController],
})
export class CallWebhooksModule {}
