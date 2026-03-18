import {
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UsersService } from './users.service';

interface JwtRequest extends Request {
  user: JwtPayload;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private assertDirectorRole = (user: JwtPayload): void => {
    const ok =
      user.role === UserRole.Developer ||
      user.role === UserRole.EnterpriseAdmin ||
      user.role === UserRole.IsAdmin ||
      user.role === UserRole.Director;
    if (!ok) {
      throw new ForbiddenException('ディレクター権限が必要です');
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
}

