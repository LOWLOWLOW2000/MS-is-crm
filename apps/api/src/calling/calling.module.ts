import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { CallingController } from './calling.controller';
import { CallingService } from './calling.service';

@Module({
  imports: [NotificationsModule],
  controllers: [CallingController],
  providers: [CallingService],
})
export class CallingModule {}

