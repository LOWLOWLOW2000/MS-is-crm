import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ListGenerationController } from './list-generation.controller';
import { ListGenerationService } from './list-generation.service';

@Module({
  imports: [PrismaModule],
  controllers: [ListGenerationController],
  providers: [ListGenerationService],
  exports: [ListGenerationService],
})
export class ListGenerationModule {}
