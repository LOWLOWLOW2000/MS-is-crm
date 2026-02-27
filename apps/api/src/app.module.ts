import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CallingModule } from './calling/calling.module';
import { ListsModule } from './lists/lists.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, CallingModule, ListsModule],
  controllers: [AppController],
})
export class AppModule {}
