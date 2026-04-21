import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  Patch,
  Post,
  Put,
  Param,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateCallingPackSnapshotDto } from './dto/create-calling-pack-snapshot.dto'
import { PublishCallingPackSnapshotDto } from './dto/publish-calling-pack-snapshot.dto'
import { UpdateCallingSettingsDto } from './dto/update-calling-settings.dto';
import { CallingSettings } from './entities/calling-settings.entity';
import { PublishedCallingPacks, SettingsService } from './settings.service'

interface JwtRequest extends Request {
  user: JwtPayload;
}

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('calling')
  async getCallingSettings(@Req() req: JwtRequest): Promise<CallingSettings> {
    try {
      return await this.settingsService.getCallingSettings(req.user);
    } catch {
      throw new InternalServerErrorException('設定取得に失敗しました');
    }
  }

  @Patch('calling')
  async updateCallingSettings(
    @Req() req: JwtRequest,
    @Body() dto: UpdateCallingSettingsDto,
  ): Promise<CallingSettings> {
    try {
      if (!this.settingsService.canUpdateCallingSettings(req.user)) {
        throw new ForbiddenException('developer 以外は承認スイッチを変更できません');
      }

      return await this.settingsService.updateCallingSettings(req.user, dto);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('設定更新に失敗しました');
    }
  }

  @Post('calling/sales-room-content-ack')
  async acknowledgeSalesRoomContent(@Req() req: JwtRequest): Promise<CallingSettings> {
    try {
      return await this.settingsService.acknowledgeSalesRoomContent(req.user);
    } catch {
      throw new InternalServerErrorException('承認の記録に失敗しました');
    }
  }

  @Get('calling/packs')
  async getPublishedCallingPacks(
    @Req() req: JwtRequest,
  ): Promise<PublishedCallingPacks> {
    try {
      return await this.settingsService.getPublishedCallingPacks(req.user)
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException) throw error
      throw new InternalServerErrorException('pack の取得に失敗しました')
    }
  }

  @Post('calling/packs/:kind/snapshots')
  async createCallingPackSnapshot(
    @Req() req: JwtRequest,
    @Param('kind') kind: string,
    @Body() dto: CreateCallingPackSnapshotDto,
  ): Promise<{ id: string; kind: string; createdAt: string }> {
    try {
      return await this.settingsService.createCallingPackSnapshot(req.user, kind, dto.bodyJson)
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException) throw error
      throw new InternalServerErrorException('pack の保存に失敗しました')
    }
  }

  @Put('calling/packs/:kind/published')
  async publishCallingPackSnapshot(
    @Req() req: JwtRequest,
    @Param('kind') kind: string,
    @Body() dto: PublishCallingPackSnapshotDto,
  ): Promise<{ tenantId: string; kind: string; publishedSnapshotId: string }> {
    try {
      return await this.settingsService.publishCallingPackSnapshot(req.user, kind, dto.snapshotId)
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException) throw error
      throw new InternalServerErrorException('pack の公開切替に失敗しました')
    }
  }
}
