import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UpdateCompanyDto } from './dto/update-company.dto';

type LegalEntitySnapshotPayload = {
  legalEntity: {
    id: string;
    name: string;
    headOfficeAddress: string | null;
    status: string | null;
  };
  establishments: {
    name: string;
    address: string | null;
    type: string | null;
  }[];
  personas: {
    name: string;
    departmentName: string | null;
    phone: string | null;
    email: string | null;
  }[];
};

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  getOrCreateMyCompany = async (user: JwtPayload) => {
    const nowIso = new Date().toISOString()

    const existing = await this.prisma.legalEntity.findFirst({
      where: { tenantId: user.tenantId },
      include: {
        establishments: { orderBy: { createdAt: 'asc' } },
        departments: { orderBy: { createdAt: 'asc' } },
        personas: { include: { department: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    })
    if (existing) {
      return existing
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { companyName: true, name: true, headOfficeAddress: true },
    })
    const companyName = (tenant?.companyName ?? tenant?.name ?? '未設定').trim() || '未設定'

    const created = await this.prisma.legalEntity.create({
      data: {
        tenantId: user.tenantId,
        name: companyName,
        headOfficeAddress: tenant?.headOfficeAddress ?? null,
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      include: {
        establishments: { orderBy: { createdAt: 'asc' } },
        departments: { orderBy: { createdAt: 'asc' } },
        personas: { include: { department: true }, orderBy: { createdAt: 'asc' } },
      },
    })

    return created
  }

  getCompany = async (user: JwtPayload, legalEntityId: string) => {
    const row = await this.prisma.legalEntity.findFirst({
      where: { id: legalEntityId, tenantId: user.tenantId },
      include: {
        establishments: { orderBy: { createdAt: 'asc' } },
        departments: { orderBy: { createdAt: 'asc' } },
        personas: { include: { department: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('企業が見つかりません');
    return row;
  };

  private buildSnapshot = async (user: JwtPayload, legalEntityId: string): Promise<LegalEntitySnapshotPayload> => {
    const row = await this.prisma.legalEntity.findFirst({
      where: { id: legalEntityId, tenantId: user.tenantId },
      include: {
        establishments: true,
        personas: { include: { department: true } },
      },
    });
    if (!row) throw new NotFoundException('企業が見つかりません');

    return {
      legalEntity: {
        id: row.id,
        name: row.name,
        headOfficeAddress: row.headOfficeAddress ?? null,
        status: (row as { status?: string | null }).status ?? null,
      },
      establishments: row.establishments.map((e) => ({
        name: e.name,
        address: e.address ?? null,
        type: e.type ?? null,
      })),
      personas: row.personas.map((p) => ({
        name: p.name,
        departmentName: p.department?.name ?? null,
        phone: p.phone ?? null,
        email: (p as { email?: string | null }).email ?? null,
      })),
    };
  };

  updateCompanyWithSnapshot = async (user: JwtPayload, legalEntityId: string, dto: UpdateCompanyDto) => {
    const nowIso = new Date().toISOString();

    // 企業が存在するか確認しつつ、更新前スナップショットを保存
    const snapshot = await this.buildSnapshot(user, legalEntityId);

    return await this.prisma.$transaction(async (tx) => {
      await tx.legalEntitySnapshot.create({
        data: {
          tenantId: user.tenantId,
          legalEntityId,
          snapshot,
          createdBy: user.sub,
          createdAt: nowIso,
        },
      });

      await tx.legalEntity.update({
        where: { id: legalEntityId },
        data: {
          tenantId: user.tenantId,
          name: dto.legalEntity.name,
          headOfficeAddress: dto.legalEntity.headOfficeAddress ?? null,
          status: dto.legalEntity.status ?? null,
          updatedAt: nowIso,
        },
      });

      // 拠点は全置換（履歴は snapshot 側で保持）
      await tx.establishment.deleteMany({ where: { tenantId: user.tenantId, legalEntityId } });
      if (dto.establishments.length > 0) {
        await tx.establishment.createMany({
          data: dto.establishments.map((e) => ({
            tenantId: user.tenantId,
            legalEntityId,
            name: e.name,
            address: e.address ?? null,
            type: e.type ?? null,
            createdAt: nowIso,
            updatedAt: nowIso,
          })),
        });
      }

      // 担当者も全置換（部署は name で作成/紐付け）
      await tx.persona.deleteMany({ where: { tenantId: user.tenantId, legalEntityId } });
      for (const p of dto.personas) {
        const deptName = p.departmentName?.trim() ?? '';
        let departmentId: string | null = null;
        if (deptName.length > 0) {
          const existing = await tx.department.findFirst({
            where: { tenantId: user.tenantId, legalEntityId, name: deptName },
            select: { id: true },
          });
          if (existing) {
            departmentId = existing.id;
          } else {
            const created = await tx.department.create({
              data: {
                tenantId: user.tenantId,
                legalEntityId,
                name: deptName,
                roleCategory: null,
                createdAt: nowIso,
                updatedAt: nowIso,
              },
              select: { id: true },
            });
            departmentId = created.id;
          }
        }

        await tx.persona.create({
          data: {
            tenantId: user.tenantId,
            legalEntityId,
            departmentId,
            name: p.name,
            phone: p.phone ?? null,
            email: p.email ?? null,
            roleRank: null,
            authority: null,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        });
      }

      const updated = await tx.legalEntity.findFirst({
        where: { id: legalEntityId, tenantId: user.tenantId },
        include: {
          establishments: { orderBy: { createdAt: 'asc' } },
          personas: { include: { department: true }, orderBy: { createdAt: 'asc' } },
        },
      });
      if (!updated) throw new NotFoundException('企業が見つかりません');
      return { company: updated, canUndo: true };
    });
  };

  restoreLatestSnapshot = async (user: JwtPayload, legalEntityId: string) => {
    const latest = await this.prisma.legalEntitySnapshot.findFirst({
      where: { tenantId: user.tenantId, legalEntityId },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) {
      throw new NotFoundException('復元できる履歴がありません');
    }

    const nowIso = new Date().toISOString();
    const payload = latest.snapshot as unknown as LegalEntitySnapshotPayload;

    return await this.prisma.$transaction(async (tx) => {
      await tx.legalEntity.update({
        where: { id: legalEntityId },
        data: {
          tenantId: user.tenantId,
          name: payload.legalEntity.name,
          headOfficeAddress: payload.legalEntity.headOfficeAddress,
          status: payload.legalEntity.status,
          updatedAt: nowIso,
        },
      });

      await tx.establishment.deleteMany({ where: { tenantId: user.tenantId, legalEntityId } });
      if (payload.establishments.length > 0) {
        await tx.establishment.createMany({
          data: payload.establishments.map((e) => ({
            tenantId: user.tenantId,
            legalEntityId,
            name: e.name,
            address: e.address,
            type: e.type,
            createdAt: nowIso,
            updatedAt: nowIso,
          })),
        });
      }

      await tx.persona.deleteMany({ where: { tenantId: user.tenantId, legalEntityId } });
      for (const p of payload.personas) {
        const deptName = (p.departmentName ?? '').trim();
        let departmentId: string | null = null;
        if (deptName.length > 0) {
          const existing = await tx.department.findFirst({
            where: { tenantId: user.tenantId, legalEntityId, name: deptName },
            select: { id: true },
          });
          if (existing) {
            departmentId = existing.id;
          } else {
            const created = await tx.department.create({
              data: {
                tenantId: user.tenantId,
                legalEntityId,
                name: deptName,
                roleCategory: null,
                createdAt: nowIso,
                updatedAt: nowIso,
              },
              select: { id: true },
            });
            departmentId = created.id;
          }
        }

        await tx.persona.create({
          data: {
            tenantId: user.tenantId,
            legalEntityId,
            departmentId,
            name: p.name,
            phone: p.phone,
            email: p.email,
            roleRank: null,
            authority: null,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        });
      }

      // Undo を 1段にするため、使ったスナップショットは削除（=「もとに戻す」1回分）
      await tx.legalEntitySnapshot.delete({ where: { id: latest.id } });

      const restored = await tx.legalEntity.findFirst({
        where: { id: legalEntityId, tenantId: user.tenantId },
        include: {
          establishments: { orderBy: { createdAt: 'asc' } },
          personas: { include: { department: true }, orderBy: { createdAt: 'asc' } },
        },
      });
      if (!restored) throw new NotFoundException('企業が見つかりません');

      const stillHasSnapshots = await tx.legalEntitySnapshot.findFirst({
        where: { tenantId: user.tenantId, legalEntityId },
        select: { id: true },
      });

      return { company: restored, canUndo: Boolean(stillHasSnapshots) };
    });
  };
}

