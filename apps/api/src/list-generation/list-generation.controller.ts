import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateListGenerationRequestDto } from './dto/create-request.dto';
import type { CreateMasterDto } from './dto/create-master.dto';
import { ListGenerationService } from './list-generation.service';

interface JwtRequest extends Request {
  user: JwtPayload;
}

/**
 * Phase2: リスト生成マスタ（エリア・業種・キーワード）とリクエストAPI
 */
@Controller('list-generation')
@UseGuards(JwtAuthGuard)
export class ListGenerationController {
  constructor(private readonly listGenerationService: ListGenerationService) {}

  // ---------- エリアマスタ ----------
  @Get('areas')
  listAreas(@Req() req: JwtRequest) {
    return this.listGenerationService.listAreas(req.user);
  }

  @Post('areas')
  createArea(@Req() req: JwtRequest, @Body() dto: CreateMasterDto) {
    return this.listGenerationService.createArea(req.user, dto);
  }

  @Patch('areas/:id')
  updateArea(
    @Req() req: JwtRequest,
    @Param('id') id: string,
    @Body() dto: { name?: string; isActive?: boolean },
  ) {
    return this.listGenerationService.updateArea(req.user, id, dto);
  }

  @Delete('areas/:id')
  async deleteArea(@Req() req: JwtRequest, @Param('id') id: string) {
    await this.listGenerationService.deleteArea(req.user, id);
  }

  // ---------- 業種マスタ ----------
  @Get('industries')
  listIndustries(@Req() req: JwtRequest) {
    return this.listGenerationService.listIndustries(req.user);
  }

  @Post('industries')
  createIndustry(@Req() req: JwtRequest, @Body() dto: CreateMasterDto) {
    return this.listGenerationService.createIndustry(req.user, dto);
  }

  @Patch('industries/:id')
  updateIndustry(
    @Req() req: JwtRequest,
    @Param('id') id: string,
    @Body() dto: { name?: string; isActive?: boolean },
  ) {
    return this.listGenerationService.updateIndustry(req.user, id, dto);
  }

  @Delete('industries/:id')
  async deleteIndustry(@Req() req: JwtRequest, @Param('id') id: string) {
    await this.listGenerationService.deleteIndustry(req.user, id);
  }

  // ---------- キーワードマスタ ----------
  @Get('keywords')
  listKeywords(@Req() req: JwtRequest) {
    return this.listGenerationService.listKeywords(req.user);
  }

  @Post('keywords')
  createKeyword(@Req() req: JwtRequest, @Body() dto: CreateMasterDto) {
    return this.listGenerationService.createKeyword(req.user, dto);
  }

  @Patch('keywords/:id')
  updateKeyword(
    @Req() req: JwtRequest,
    @Param('id') id: string,
    @Body() dto: { name?: string; isActive?: boolean },
  ) {
    return this.listGenerationService.updateKeyword(req.user, id, dto);
  }

  @Delete('keywords/:id')
  async deleteKeyword(@Req() req: JwtRequest, @Param('id') id: string) {
    await this.listGenerationService.deleteKeyword(req.user, id);
  }

  // ---------- リスト生成リクエスト ----------
  @Post('requests')
  createRequest(
    @Req() req: JwtRequest,
    @Body() dto: CreateListGenerationRequestDto,
  ) {
    return this.listGenerationService.createRequest(req.user, dto);
  }

  @Get('requests')
  listRequests(
    @Req() req: JwtRequest,
    @Query('status') status?: string,
    @Query('assignedToEmail') assignedToEmail?: string,
  ) {
    return this.listGenerationService.listRequests(req.user, {
      status,
      assignedToEmail,
    });
  }

  @Get('requests/:id')
  getRequest(@Req() req: JwtRequest, @Param('id') id: string) {
    return this.listGenerationService.getRequest(req.user, id);
  }

  @Patch('requests/:id/result')
  updateRequestResult(
    @Req() req: JwtRequest,
    @Param('id') id: string,
    @Body()
    dto: { status?: string; resultListId?: string; errorMessage?: string },
  ) {
    return this.listGenerationService.updateRequestResult(req.user, id, dto);
  }
}
