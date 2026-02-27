import { Injectable } from '@nestjs/common';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UpdateCallingSettingsDto } from './dto/update-calling-settings.dto';
import { CallingSettings } from './entities/calling-settings.entity';

@Injectable()
export class SettingsService {
  private readonly callingSettingsByTenant = new Map<string, CallingSettings>();

  private getDefault = (user: JwtPayload): CallingSettings => {
    return {
      tenantId: user.tenantId,
      humanApprovalEnabled: true,
      updatedBy: user.sub,
      updatedAt: new Date().toISOString(),
    };
  };

  getCallingSettings = (user: JwtPayload): CallingSettings => {
    const current = this.callingSettingsByTenant.get(user.tenantId);
    if (current) {
      return current;
    }

    const defaults = this.getDefault(user);
    this.callingSettingsByTenant.set(user.tenantId, defaults);
    return defaults;
  };

  updateCallingSettings = (user: JwtPayload, dto: UpdateCallingSettingsDto): CallingSettings => {
    const next: CallingSettings = {
      tenantId: user.tenantId,
      humanApprovalEnabled: dto.humanApprovalEnabled,
      updatedBy: user.sub,
      updatedAt: new Date().toISOString(),
    };

    this.callingSettingsByTenant.set(user.tenantId, next);
    return next;
  };

  canUpdateCallingSettings = (user: JwtPayload): boolean => {
    return user.role === UserRole.Developer;
  };
}
