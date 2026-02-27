import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UpdateCallingSettingsDto } from './dto/update-calling-settings.dto';
import { CallingSettings } from './entities/calling-settings.entity';
import { SettingsService } from './settings.service';

interface JwtRequest extends Request {
  user: JwtPayload;
}

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('calling')
  getCallingSettings(@Req() req: JwtRequest): CallingSettings {
    try {
      return this.settingsService.getCallingSettings(req.user);
    } catch {
      throw new InternalServerErrorException('設定取得に失敗しました');
    }
  }

  @Patch('calling')
  updateCallingSettings(
    @Req() req: JwtRequest,
    @Body() dto: UpdateCallingSettingsDto,
  ): CallingSettings {
    try {
      if (!this.settingsService.canUpdateCallingSettings(req.user)) {
        throw new ForbiddenException('developer 以外は承認スイッチを変更できません');
      }

      return this.settingsService.updateCallingSettings(req.user, dto);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('設定更新に失敗しました');
    }
  }
}
