import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CallingModule } from './calling/calling.module';
import { HealthModule } from './health/health.module';
import { ListsModule } from './lists/lists.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { ScriptsModule } from './scripts/scripts.module';
import { SettingsModule } from './settings/settings.module';
import { ZoomModule } from './zoom/zoom.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    AiModule,
    CallingModule,
    ListsModule,
    ReportsModule,
    ScriptsModule,
    SettingsModule,
    ZoomModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
