import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CallingModule } from './calling/calling.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, CallingModule],
  controllers: [AppController],
})
export class AppModule {}
