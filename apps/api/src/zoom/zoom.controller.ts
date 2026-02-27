import {
  Body,
  Controller,
  Get,
  Headers,
  InternalServerErrorException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { ZoomUrlValidationResponseDto, ZoomWebhookDto } from './dto/zoom-webhook.dto';
import { ZoomCallLog } from './entities/zoom-call-log.entity';
import { ZoomService } from './zoom.service';

interface JwtRequest extends Request {
  user: JwtPayload;
}

@Controller('zoom')
export class ZoomController {
  constructor(private readonly zoomService: ZoomService) {}

  @Post('webhook')
  handleWebhook(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() dto: ZoomWebhookDto,
  ): { ok: true } | ZoomUrlValidationResponseDto {
    try {
      const isValidToken = this.zoomService.verifyWebhookToken(authorizationHeader);
      if (!isValidToken) {
        throw new UnauthorizedException('Webhookトークンが不正です');
      }

      const validationResponse = this.zoomService.buildUrlValidationResponse(dto);
      if (validationResponse) {
        return validationResponse;
      }

      this.zoomService.handleWebhookEvent(dto);
      return { ok: true };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('ZOOM Webhook処理に失敗しました');
    }
  }

  @Get('calls')
  @UseGuards(JwtAuthGuard)
  getRecentCallLogs(@Req() req: JwtRequest): ZoomCallLog[] {
    try {
      return this.zoomService.getRecentCallLogs(req.user);
    } catch {
      throw new InternalServerErrorException('ZOOM通話ログの取得に失敗しました');
    }
  }
}
