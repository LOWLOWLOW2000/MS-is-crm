import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompaniesService } from './companies.service';

interface JwtRequest extends Request {
  user: JwtPayload;
}

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get(':legalEntityId')
  async getCompany(@Req() req: JwtRequest, @Param('legalEntityId') legalEntityId: string) {
    try {
      return await this.companiesService.getCompany(req.user, legalEntityId);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('企業情報の取得に失敗しました');
    }
  }

  @Post(':legalEntityId')
  async updateCompany(
    @Req() req: JwtRequest,
    @Param('legalEntityId') legalEntityId: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    try {
      return await this.companiesService.updateCompanyWithSnapshot(req.user, legalEntityId, dto);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('企業情報の保存に失敗しました');
    }
  }

  @Post(':legalEntityId/restore-latest')
  async restoreLatest(@Req() req: JwtRequest, @Param('legalEntityId') legalEntityId: string) {
    try {
      return await this.companiesService.restoreLatestSnapshot(req.user, legalEntityId);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('企業情報の復元に失敗しました');
    }
  }
}

