import {
  Body,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateTalkScriptVersionDto } from './dto/create-talk-script-version.dto';
import { QueryTalkScriptTypeDto } from './dto/query-talk-script-type.dto';
import { UpdateTalkScriptVersionDto } from './dto/update-talk-script-version.dto';
import { TalkScriptsService } from './talk-scripts.service';

interface JwtRequest extends Request {
  user: JwtPayload;
}

@Controller('talk-scripts')
@UseGuards(JwtAuthGuard)
export class TalkScriptsController {
  constructor(private readonly talkScriptsService: TalkScriptsService) {}

  @Get('published')
  async listPublished(@Req() req: JwtRequest, @Query() query: QueryTalkScriptTypeDto) {
    try {
      return await this.talkScriptsService.listPublished(req.user, query.type);
    } catch {
      throw new InternalServerErrorException('公開スクリプト一覧の取得に失敗しました');
    }
  }

  @Get('published/:versionId')
  async getPublished(@Req() req: JwtRequest, @Param('versionId') versionId: string) {
    try {
      return await this.talkScriptsService.getPublishedVersion(req.user, versionId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('スクリプトの取得に失敗しました');
    }
  }

  @Get('drafts')
  async listDrafts(@Req() req: JwtRequest, @Query() query: QueryTalkScriptTypeDto) {
    try {
      return await this.talkScriptsService.listDrafts(req.user, query.type);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('下書き一覧の取得に失敗しました');
    }
  }

  @Get('drafts/:versionId')
  async getDraft(@Req() req: JwtRequest, @Param('versionId') versionId: string) {
    try {
      return await this.talkScriptsService.getVersionForEdit(req.user, versionId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('バージョンの取得に失敗しました');
    }
  }

  @Post('versions')
  async createVersion(@Req() req: JwtRequest, @Body() dto: CreateTalkScriptVersionDto) {
    try {
      return await this.talkScriptsService.createVersion(req.user, dto);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('バージョンの作成に失敗しました');
    }
  }

  @Patch('versions/:versionId')
  async updateVersion(
    @Req() req: JwtRequest,
    @Param('versionId') versionId: string,
    @Body() dto: UpdateTalkScriptVersionDto,
  ) {
    try {
      await this.talkScriptsService.updateVersion(req.user, versionId, dto);
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('バージョンの更新に失敗しました');
    }
  }

  @Post('versions/:versionId/publish')
  async publish(@Req() req: JwtRequest, @Param('versionId') versionId: string) {
    try {
      await this.talkScriptsService.publishVersion(req.user, versionId);
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('公開に失敗しました');
    }
  }
}
