import { Injectable } from '@nestjs/common';
import { hasRole } from '../common/auth/role-utils';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UpdateCallingSettingsDto } from './dto/update-calling-settings.dto';
import { CallingSettings } from './entities/calling-settings.entity';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  getCallingSettings = async (user: JwtPayload): Promise<CallingSettings> => {
    const now = new Date().toISOString();
    const row = await this.prisma.callingSettings.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        humanApprovalEnabled: true,
        updatedBy: user.sub,
        updatedAt: now,
      },
      update: {},
    });
    return {
      tenantId: row.tenantId,
      humanApprovalEnabled: row.humanApprovalEnabled,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  };

  updateCallingSettings = async (user: JwtPayload, dto: UpdateCallingSettingsDto): Promise<CallingSettings> => {
    const now = new Date().toISOString();
    const row = await this.prisma.callingSettings.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        humanApprovalEnabled: dto.humanApprovalEnabled,
        updatedBy: user.sub,
        updatedAt: now,
      },
      update: {
        humanApprovalEnabled: dto.humanApprovalEnabled,
        updatedBy: user.sub,
        updatedAt: now,
      },
    });
    return {
      tenantId: row.tenantId,
      humanApprovalEnabled: row.humanApprovalEnabled,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  };

  canUpdateCallingSettings = (user: JwtPayload): boolean => {
    return hasRole(user, UserRole.Developer);
  };
}
