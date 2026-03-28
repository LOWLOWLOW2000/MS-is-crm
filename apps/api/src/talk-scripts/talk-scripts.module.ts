import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TalkScriptsController } from './talk-scripts.controller';
import { TalkScriptsService } from './talk-scripts.service';

@Module({
  imports: [PrismaModule],
  controllers: [TalkScriptsController],
  providers: [TalkScriptsService],
  exports: [TalkScriptsService],
})
export class TalkScriptsModule {}
