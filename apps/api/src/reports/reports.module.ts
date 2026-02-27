import { Module } from '@nestjs/common';
import { CallingModule } from '../calling/calling.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [CallingModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
