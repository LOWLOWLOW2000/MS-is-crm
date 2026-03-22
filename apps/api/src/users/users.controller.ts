import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { hasAnyRole } from '../common/auth/role-utils';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UpdateUserTierDto } from './dto/update-user-tier.dto';
import { UsersService } from './users.service';

interface JwtRequest extends Request {
  user: JwtPayload;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private assertDirectorRole = (user: JwtPayload): void => {
    const ok = hasAnyRole(user, [
      UserRole.Developer,
      UserRole.EnterpriseAdmin,
      UserRole.IsAdmin,
      UserRole.Director,
    ]);
    if (!ok) {
      throw new ForbiddenException('ディレクター権限が必要です');
    }
  };

  private assertTierEditor = (user: JwtPayload): void => {
    const ok = hasAnyRole(user, [UserRole.EnterpriseAdmin, UserRole.Director]);
    if (!ok) {
      throw new ForbiddenException('企業管理者またはディレクターのみロールを変更できます');
    }
  };

  @Get()
  async getUsers(@Req() req: JwtRequest) {
    try {
      this.assertDirectorRole(req.user);
      return await this.usersService.getUsers(req.user);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('ユーザー一覧の取得に失敗しました');
    }
  }

  /** BOX 相当: director / is_member の切替（詳細は UsersService.assignTierBox） */
  @Patch(':id/tier')
  async assignTier(
    @Req() req: JwtRequest,
    @Param('id') id: string,
    @Body() dto: UpdateUserTierDto,
  ) {
    try {
      this.assertTierEditor(req.user);
      return await this.usersService.assignTierBox(req.user, id, dto.box);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('ユーザーのロール更新に失敗しました');
    }
  }

  /** 既定PJから除名: director / is_member を外し project_memberships を削除 */
  @Delete(':id/pj-membership')
  async removePjMembership(@Req() req: JwtRequest, @Param('id') id: string) {
    try {
      this.assertTierEditor(req.user);
      return await this.usersService.removeUserFromProject(req.user, id);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('PJからの除名に失敗しました');
    }
  }
}

