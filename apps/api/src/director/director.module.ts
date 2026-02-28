import { Module } from '@nestjs/common';
import { CallingModule } from '../calling/calling.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DirectorController } from './director.controller';
import { DirectorService } from './director.service';

@Module({
  imports: [CallingModule, NotificationsModule],
  controllers: [DirectorController],
  providers: [DirectorService],
})
export class DirectorModule {}
