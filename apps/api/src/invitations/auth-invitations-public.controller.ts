import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AuthResponseDto } from '../auth/dto/auth-response.dto';
import { AcceptInvitationDto } from '../auth/dto/accept-invitation.dto';
import { InvitationsService } from './invitations.service';

/** 招待 URL 用の公開エンドポイント（JWT 不要） */
@Controller('auth')
export class AuthInvitationsPublicController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get('invitations/validate')
  async validateInvitation(@Query('token') token: string) {
    return this.invitationsService.validateToken(token ?? '');
  }

  @Post('invitations/accept')
  async acceptInvitation(@Body() dto: AcceptInvitationDto): Promise<AuthResponseDto> {
    return this.invitationsService.acceptInvitation({
      plainToken: dto.token,
      password: dto.password,
      name: dto.name,
    });
  }
}
