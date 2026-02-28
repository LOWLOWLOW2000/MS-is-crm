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
}
