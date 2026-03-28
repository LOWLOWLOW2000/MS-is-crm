import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import type { TenantProfile } from './entities/tenant-profile.entity';
import { TenantsService } from './tenants.service';

interface JwtRequest extends Request {
  user: JwtPayload;
}

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  async getMyTenant(@Req() req: JwtRequest): Promise<TenantProfile> {
    return await this.tenantsService.getMyTenant(req.user);
  }

  @Patch('me')
  async patchMyTenant(@Req() req: JwtRequest, @Body() dto: UpdateTenantDto): Promise<TenantProfile> {
    return await this.tenantsService.updateMyTenant(req.user, dto);
  }
}
