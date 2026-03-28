import { Module } from '@nestjs/common';
import { KpiGoalsController } from './kpi-goals.controller';
import { KpiGoalsService } from './kpi-goals.service';

@Module({
  controllers: [KpiGoalsController],
  providers: [KpiGoalsService],
  exports: [KpiGoalsService],
})
export class KpiGoalsModule {}
