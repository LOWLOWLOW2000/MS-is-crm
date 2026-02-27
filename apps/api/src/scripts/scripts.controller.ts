import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UpsertScriptTemplateDto } from './dto/upsert-script-template.dto';
import { ScriptTemplate } from './entities/script-template.entity';
import { ScriptsService } from './scripts.service';

interface JwtRequest extends Request {
  user: JwtPayload;
}

@Controller('scripts')
@UseGuards(JwtAuthGuard)
export class ScriptsController {
  constructor(private readonly scriptsService: ScriptsService) {}

  private assertNotIsMember = (user: JwtPayload): void => {
    if (user.role === UserRole.IsMember) {
      throw new ForbiddenException('is_member はスクリプト管理にアクセスできません');
    }
  };

  @Get()
  getTemplates(@Req() req: JwtRequest): ScriptTemplate[] {
    try {
      this.assertNotIsMember(req.user);
      return this.scriptsService.getTemplates(req.user);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('スクリプト一覧の取得に失敗しました');
    }
  }

  @Post()
  createTemplate(@Req() req: JwtRequest, @Body() dto: UpsertScriptTemplateDto): ScriptTemplate {
    try {
      this.assertNotIsMember(req.user);
      return this.scriptsService.createTemplate(req.user, dto);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('スクリプト作成に失敗しました');
    }
  }

  @Patch(':templateId')
  updateTemplate(
    @Req() req: JwtRequest,
    @Param('templateId') templateId: string,
    @Body() dto: UpsertScriptTemplateDto,
  ): ScriptTemplate {
    try {
      this.assertNotIsMember(req.user);
      return this.scriptsService.updateTemplate(req.user, templateId, dto);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('スクリプト更新に失敗しました');
    }
  }

  @Delete(':templateId')
  deleteTemplate(@Req() req: JwtRequest, @Param('templateId') templateId: string): { ok: true } {
    try {
      this.assertNotIsMember(req.user);
      this.scriptsService.deleteTemplate(req.user, templateId);
      return { ok: true };
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('スクリプト削除に失敗しました');
    }
  }
}
