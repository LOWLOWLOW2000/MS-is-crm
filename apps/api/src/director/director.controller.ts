import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import type { DirectorOverviewDto } from './dto/director-overview.dto';
import { SendWhisperDto } from './dto/send-whisper.dto';
import { DirectorService } from './director.service';

interface JwtRequest extends Request {
  user: JwtPayload;
}

@Controller('director')
@UseGuards(JwtAuthGuard)
export class DirectorController {
  constructor(private readonly directorService: DirectorService) {}

  @Get('overview')
  async getOverview(@Req() req: JwtRequest): Promise<DirectorOverviewDto> {
    try {
      return await this.directorService.getOverview(req.user);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('ディレクター概要の取得に失敗しました');
    }
  }

  /** Phase2: ISへのテキスト囁き送信。WebSocket director:message で配信 */
  @Post('whisper')
  async sendWhisper(@Req() req: JwtRequest, @Body() dto: SendWhisperDto): Promise<{ ok: true }> {
    try {
      return await this.directorService.sendWhisper(req.user, dto.requestId, dto.message);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('囁きの送信に失敗しました');
    }
  }

  /**
   * アポ・資料請求（= 資料送付）管理用: 件数サマリ
   * MVP: 直近24時間に「アポ/資料送付」が1件でもあればナビにバッジを出す用途
   */
  @Get('requests/summary')
  async getRequestsSummary(@Req() req: JwtRequest): Promise<{
    unreadTotal: number
    unreadAppointment: number
    unreadMaterial: number
  }> {
    try {
      return await this.directorService.getRequestsSummary(req.user)
    } catch (error) {
      if (error instanceof ForbiddenException) throw error
      throw new InternalServerErrorException('アポ・資料請求サマリの取得に失敗しました')
    }
  }

  /**
   * アポ・資料請求（= 資料送付）管理用: 一覧
   */
  @Get('requests')
  async getRequests(@Req() req: JwtRequest): Promise<
    {
      id: string
      type: 'appointment' | 'material'
      createdAt: string
      companyName: string
      targetUrl: string
      memo: string
      createdByUserId: string
      createdByName?: string
      isRead: boolean
      directorReadAt: string | null
    }[]
  > {
    try {
      return await this.directorService.getRequests(req.user)
    } catch (error) {
      if (error instanceof ForbiddenException) throw error
      throw new InternalServerErrorException('アポ・資料請求一覧の取得に失敗しました')
    }
  }

  @Post('requests/read')
  async markRequestsAsRead(
    @Req() req: JwtRequest,
    @Body() body: { ids?: string[]; markAll?: boolean },
  ): Promise<{ updated: number }> {
    try {
      return await this.directorService.markRequestsAsRead(req.user, body)
    } catch (error) {
      if (error instanceof ForbiddenException) throw error
      throw new InternalServerErrorException('アポ・資料請求の既読化に失敗しました')
    }
  }
}
