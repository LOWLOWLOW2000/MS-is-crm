import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../common/enums/user-role.enum';
import { hasAnyRole } from '../common/auth/role-utils';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import type { TenantProfile } from './entities/tenant-profile.entity';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertTenantAdmin = (user: JwtPayload): void => {
    const ok = hasAnyRole(user, [UserRole.EnterpriseAdmin, UserRole.Developer]);
    if (!ok) {
      throw new ForbiddenException('企業管理者のみがテナント情報を更新できます');
    }
  };

  private toProfile = (row: {
    id: string;
    name: string;
    companyName: string | null;
    headOfficeAddress: string | null;
    headOfficePhone: string | null;
    representativeName: string | null;
    accountStatus: string;
    projectDisplayName: string | null;
    accountManagerUserIds: string[];
    createdAt: string;
    updatedAt: string;
  }): TenantProfile => ({
    id: row.id,
    name: row.name,
    companyName: row.companyName,
    headOfficeAddress: row.headOfficeAddress,
    headOfficePhone: row.headOfficePhone,
    representativeName: row.representativeName,
    accountStatus: row.accountStatus,
    projectDisplayName: row.projectDisplayName,
    accountManagerUserIds: row.accountManagerUserIds ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  getMyTenant = async (user: JwtPayload): Promise<TenantProfile> => {
    const row = await this.prisma.tenant.findFirst({
      where: { id: user.tenantId },
    });
    if (!row) {
      throw new NotFoundException('テナントが見つかりません');
    }
    return this.toProfile(row);
  };

  updateMyTenant = async (user: JwtPayload, dto: UpdateTenantDto): Promise<TenantProfile> => {
    this.assertTenantAdmin(user);

    if (dto.accountManagerUserIds !== undefined && dto.accountManagerUserIds.length > 0) {
      const unique = [...new Set(dto.accountManagerUserIds)];
      const rows = await this.prisma.user.findMany({
        where: {
          tenantId: user.tenantId,
          id: { in: unique },
        },
        select: { id: true },
      });
      if (rows.length !== unique.length) {
        throw new BadRequestException('AM 指定に同一テナント外のユーザーが含まれています');
      }
    }

    const now = new Date().toISOString();
    const data: Record<string, unknown> = { updatedAt: now };

    if (dto.companyName !== undefined) data.companyName = dto.companyName.trim() || null;
    if (dto.headOfficeAddress !== undefined) data.headOfficeAddress = dto.headOfficeAddress.trim() || null;
    if (dto.headOfficePhone !== undefined) data.headOfficePhone = dto.headOfficePhone.trim() || null;
    if (dto.representativeName !== undefined) data.representativeName = dto.representativeName.trim() || null;
    if (dto.projectDisplayName !== undefined) data.projectDisplayName = dto.projectDisplayName.trim() || null;
    if (dto.accountStatus !== undefined) data.accountStatus = dto.accountStatus.trim() || 'active';
    if (dto.accountManagerUserIds !== undefined) data.accountManagerUserIds = dto.accountManagerUserIds;

    const row = await this.prisma.tenant.update({
      where: { id: user.tenantId },
      data,
    });
    return this.toProfile(row);
  };
}
