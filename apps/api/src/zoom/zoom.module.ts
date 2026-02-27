import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ZoomController } from './zoom.controller';
import { ZoomService } from './zoom.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ZoomController],
  providers: [ZoomService],
})
export class ZoomModule {}
