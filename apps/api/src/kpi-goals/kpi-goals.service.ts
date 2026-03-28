import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { hasRole } from '../common/auth/role-utils';
import { UserRole } from '../common/enums/user-role.enum';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { type GetKpiGoalQueryDto } from './dto/get-kpi-goal.dto';
import {
  type KpiGoalScope,
  type UpsertKpiGoalDto,
} from './dto/upsert-kpi-goal.dto';
import { type KpiGoalEntity, type KpiGoalMatrixEntity } from './entities/kpi-goal.entity';

@Injectable()
export class KpiGoalsService {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity = (row: {
    id: string
    tenantId: string
    projectId: string
    scope: string
    targetUserId: string | null
    callPerHour: number
    appointmentRate: number
    materialSendRate: number
    redialAcquisitionRate: number
    cutContactRate: number
    keyPersonContactRate: number
    updatedBy: string
    updatedAt: string
  }): KpiGoalEntity => ({
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    scope: row.scope as KpiGoalScope,
    targetUserId: row.targetUserId,
    callPerHour: row.callPerHour,
    appointmentRate: row.appointmentRate,
    materialSendRate: row.materialSendRate,
    redialAcquisitionRate: row.redialAcquisitionRate,
    cutContactRate: row.cutContactRate,
    keyPersonContactRate: row.keyPersonContactRate,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  })

  private buildGoalKey = (scope: KpiGoalScope, targetUserId: string | null): string =>
    `${scope}:${targetUserId ?? 'all'}`

  private resolveProjectId = async (tenantId: string): Promise<string> => {
    const project = await this.prisma.project.findUnique({
      where: { tenantId },
      select: { id: true },
    })
    if (!project) {
      throw new NotFoundException('プロジェクトが見つかりません')
    }
    return project.id
  }

  private canEditProjectGoals = async (user: JwtPayload): Promise<boolean> => {
    if (hasRole(user, UserRole.Director) || hasRole(user, UserRole.Developer)) {
      return true
    }
    const projectId = await this.resolveProjectId(user.tenantId)
    const membership = await this.prisma.projectMembership.findFirst({
      where: {
        tenantId: user.tenantId,
        projectId,
        userId: user.sub,
        pjRole: 'director',
      },
      select: { id: true },
    })
    return Boolean(membership)
  }

  getGoal = async (user: JwtPayload, query: GetKpiGoalQueryDto): Promise<KpiGoalEntity | null> => {
    const projectId = await this.resolveProjectId(user.tenantId)
    const scope = query.scope ?? 'project'
    const targetUserId = scope === 'is_user' ? query.targetUserId ?? null : null
    const row = await this.prisma.kpiGoal.findFirst({
      where: {
        tenantId: user.tenantId,
        projectId,
        scope,
        targetUserId,
      },
    })
    return row ? this.toEntity(row) : null
  }

  getMatrix = async (user: JwtPayload): Promise<KpiGoalMatrixEntity> => {
    const projectId = await this.resolveProjectId(user.tenantId)
    const rows = await this.prisma.kpiGoal.findMany({
      where: {
        tenantId: user.tenantId,
        projectId,
      },
      orderBy: [{ scope: 'asc' }, { targetUserId: 'asc' }],
    })
    const entities = rows.map((row) => this.toEntity(row))
    return {
      projectGoal: entities.find((g) => g.scope === 'project') ?? null,
      isAllGoal: entities.find((g) => g.scope === 'is_all') ?? null,
      isUserGoals: entities.filter((g) => g.scope === 'is_user'),
    }
  }

  upsertGoal = async (user: JwtPayload, dto: UpsertKpiGoalDto): Promise<KpiGoalEntity> => {
    const canEdit = await this.canEditProjectGoals(user)
    if (!canEdit) {
      throw new ForbiddenException('KPI目標はディレクターのみ編集できます')
    }

    if (dto.scope === 'is_user' && !dto.targetUserId) {
      throw new ForbiddenException('is_user では targetUserId が必要です')
    }

    const projectId = await this.resolveProjectId(user.tenantId)
    const targetUserId = dto.scope === 'is_user' ? dto.targetUserId ?? null : null
    const now = new Date().toISOString()
    const goalKey = this.buildGoalKey(dto.scope, targetUserId)
    const row = await this.prisma.kpiGoal.upsert({
      where: {
        tenantId_goalKey: { tenantId: user.tenantId, goalKey },
      },
      create: {
        tenantId: user.tenantId,
        projectId,
        goalKey,
        scope: dto.scope,
        targetUserId,
        callPerHour: dto.callPerHour,
        appointmentRate: dto.appointmentRate,
        materialSendRate: dto.materialSendRate,
        redialAcquisitionRate: dto.redialAcquisitionRate,
        cutContactRate: dto.cutContactRate,
        keyPersonContactRate: dto.keyPersonContactRate,
        updatedBy: user.sub,
        updatedAt: now,
      },
      update: {
        callPerHour: dto.callPerHour,
        appointmentRate: dto.appointmentRate,
        materialSendRate: dto.materialSendRate,
        redialAcquisitionRate: dto.redialAcquisitionRate,
        cutContactRate: dto.cutContactRate,
        keyPersonContactRate: dto.keyPersonContactRate,
        updatedBy: user.sub,
        updatedAt: now,
      },
    })
    return this.toEntity(row)
  }
}
