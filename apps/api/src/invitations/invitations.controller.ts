import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { RevokeInvitationsDto } from './dto/revoke-invitations.dto';
import { InvitationsService } from './invitations.service';

interface JwtRequest extends Request {
  user: JwtPayload;
}

@Controller('tenants/:tenantId')
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  /** 企業管理者：招待一覧 */
  @Get('invitations')
  async listInvitations(
    @Req() req: JwtRequest,
    @Param('tenantId') tenantId: string,
  ) {
    return this.invitationsService.listInvitations(req.user, tenantId);
  }

  /** 企業管理者：メール招待（3日・1回限り・URL メール） */
  @Post('invitations')
  async createInvitation(
    @Req() req: JwtRequest,
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateInvitationDto,
  ): Promise<{ id: string; expiresAt: string }> {
    return this.invitationsService.createInvitation(req.user, tenantId, dto);
  }

  /** 企業管理者：未使用（有効・期限切れ問わず consumedAt なし）招待の取り消し */
  @Post('invitations/revoke')
  async revokeInvitations(
    @Req() req: JwtRequest,
    @Param('tenantId') tenantId: string,
    @Body() dto: RevokeInvitationsDto,
  ): Promise<{ revoked: number }> {
    return this.invitationsService.revokeInvitations(req.user, tenantId, dto.invitationIds);
  }
}
