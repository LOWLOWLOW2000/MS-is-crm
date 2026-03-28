import path from 'path'
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CallingModule } from './calling/calling.module';
import { DirectorModule } from './director/director.module';
import { HealthModule } from './health/health.module';
import { ListGenerationModule } from './list-generation/list-generation.module';
import { ListsModule } from './lists/lists.module';
import { CompaniesModule } from './companies/companies.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { ScriptsModule } from './scripts/scripts.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { ZoomModule } from './zoom/zoom.module';
import { InvitationsModule } from './invitations/invitations.module';
import { KpiGoalsModule } from './kpi-goals/kpi-goals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.join(__dirname, '..', '.env'),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    InvitationsModule,
    AiModule,
    CallingModule,
    DirectorModule,
    ListGenerationModule,
    ListsModule,
    CompaniesModule,
    UsersModule,
    ReportsModule,
    KpiGoalsModule,
    ScriptsModule,
    SettingsModule,
    ZoomModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
