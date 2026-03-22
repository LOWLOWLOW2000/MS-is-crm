import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthInvitationsPublicController } from './auth-invitations-public.controller';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [PrismaModule, EmailModule, AuthModule],
  controllers: [InvitationsController, AuthInvitationsPublicController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
