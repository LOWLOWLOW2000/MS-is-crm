import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { hasRole } from '../common/auth/role-utils';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UpdateCallingSettingsDto } from './dto/update-calling-settings.dto';
import { CallingSettings } from './entities/calling-settings.entity';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private rowToEntity(row: {
    tenantId: string;
    humanApprovalEnabled: boolean;
    callProviderKind: string;
    callProviderConfig: unknown;
    salesRoomContentAckAt: string | null;
    salesRoomContentAckBy: string | null;
    updatedBy: string;
    updatedAt: string;
  }): CallingSettings {
    const cfg = row.callProviderConfig;
    return {
      tenantId: row.tenantId,
      humanApprovalEnabled: row.humanApprovalEnabled,
      callProviderKind: row.callProviderKind ?? 'mock',
      callProviderConfig:
        cfg != null && typeof cfg === 'object' && !Array.isArray(cfg)
          ? (cfg as Record<string, unknown>)
          : null,
      salesRoomContentAckAt: row.salesRoomContentAckAt ?? null,
      salesRoomContentAckBy: row.salesRoomContentAckBy ?? null,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  }

  getCallingSettings = async (user: JwtPayload): Promise<CallingSettings> => {
    const now = new Date().toISOString();
    const row = await this.prisma.callingSettings.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        humanApprovalEnabled: true,
        callProviderKind: 'mock',
        updatedBy: user.sub,
        updatedAt: now,
      },
      update: {},
    });
    return this.rowToEntity(row);
  };

  updateCallingSettings = async (user: JwtPayload, dto: UpdateCallingSettingsDto): Promise<CallingSettings> => {
    const now = new Date().toISOString();
    const existing = await this.prisma.callingSettings.findUnique({
      where: { tenantId: user.tenantId },
    });

    const humanApprovalEnabled =
      dto.humanApprovalEnabled ?? existing?.humanApprovalEnabled ?? true;
    const callProviderKind = dto.callProviderKind ?? existing?.callProviderKind ?? 'mock';

    const configPayload =
      dto.callProviderConfig !== undefined
        ? dto.callProviderConfig === null
          ? Prisma.JsonNull
          : (dto.callProviderConfig as Prisma.InputJsonValue)
        : undefined;

    const row = await this.prisma.callingSettings.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        humanApprovalEnabled,
        callProviderKind,
        callProviderConfig:
          configPayload !== undefined ? configPayload : existing?.callProviderConfig ?? undefined,
        updatedBy: user.sub,
        updatedAt: now,
      },
      update: {
        humanApprovalEnabled,
        callProviderKind,
        ...(configPayload !== undefined ? { callProviderConfig: configPayload } : {}),
        updatedBy: user.sub,
        updatedAt: now,
      },
    });
    return this.rowToEntity(row);
  };

  /**
   * 架電ルームの「内容確認・承認」をテナント単位で1回だけ記録する（冪等）。
   * 既に記録済みの場合はそのまま返す。
   */
  acknowledgeSalesRoomContent = async (user: JwtPayload): Promise<CallingSettings> => {
    const now = new Date().toISOString();
    const existing = await this.prisma.callingSettings.findUnique({
      where: { tenantId: user.tenantId },
    });
    if (existing?.salesRoomContentAckAt) {
      return this.rowToEntity(existing);
    }

    const row = await this.prisma.callingSettings.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        humanApprovalEnabled: true,
        callProviderKind: 'mock',
        updatedBy: user.sub,
        updatedAt: now,
        salesRoomContentAckAt: now,
        salesRoomContentAckBy: user.sub,
      },
      update: {
        salesRoomContentAckAt: now,
        salesRoomContentAckBy: user.sub,
        updatedBy: user.sub,
        updatedAt: now,
      },
    });
    return this.rowToEntity(row);
  };

  canUpdateCallingSettings = (user: JwtPayload): boolean => {
    return hasRole(user, UserRole.Developer);
  };
}
