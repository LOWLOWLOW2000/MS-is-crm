import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ListsController],
  providers: [ListsService],
})
export class ListsModule {}
