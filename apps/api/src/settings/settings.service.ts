import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import crypto from 'node:crypto'
import { Prisma } from '../generated/prisma/client'
import { hasAnyRole, hasRole } from '../common/auth/role-utils'
import { UserRole } from '../common/enums/user-role.enum'
import { JwtPayload } from '../common/interfaces/jwt-payload.interface'
import { UpdateCallingSettingsDto } from './dto/update-calling-settings.dto'
import { CallingSettings } from './entities/calling-settings.entity'
import { PrismaService } from '../prisma/prisma.service'

export type CallingPackKind = 'script' | 'dictionary' | 'voice'

export type PublishedCallingPacks = Readonly<{
  tenantId: string
  script: Record<string, unknown> | null
  dictionary: Record<string, unknown> | null
  voice: Record<string, unknown> | null
  publishedSnapshotIds: Readonly<{
    script: string | null
    dictionary: string | null
    voice: string | null
  }>
}>

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private rowToEntity(row: {
    tenantId: string
    humanApprovalEnabled: boolean
    callProviderKind: string
    callProviderConfig: unknown
    salesRoomContentAckAt: string | null
    salesRoomContentAckBy: string | null
    updatedBy: string
    updatedAt: string
  }): CallingSettings {
    const cfg = row.callProviderConfig
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
    }
  }

  getCallingSettings = async (user: JwtPayload): Promise<CallingSettings> => {
    const now = new Date().toISOString()
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
    })
    return this.rowToEntity(row)
  }

  updateCallingSettings = async (user: JwtPayload, dto: UpdateCallingSettingsDto): Promise<CallingSettings> => {
    const now = new Date().toISOString()
    const existing = await this.prisma.callingSettings.findUnique({
      where: { tenantId: user.tenantId },
    })

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
    })
    return this.rowToEntity(row)
  }

  /**
   * 架電ルームの「内容確認・承認」をテナント単位で1回だけ記録する（冪等）。
   * 既に記録済みの場合はそのまま返す。
   */
  acknowledgeSalesRoomContent = async (user: JwtPayload): Promise<CallingSettings> => {
    const now = new Date().toISOString()
    const existing = await this.prisma.callingSettings.findUnique({
      where: { tenantId: user.tenantId },
    })
    if (existing?.salesRoomContentAckAt) {
      return this.rowToEntity(existing)
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
    })
    return this.rowToEntity(row)
  }

  canUpdateCallingSettings = (user: JwtPayload): boolean => {
    return hasRole(user, UserRole.Developer)
  }

  canManageCallingPacks = (user: JwtPayload): boolean => {
    return hasAnyRole(user, [UserRole.Director, UserRole.IsAdmin, UserRole.EnterpriseAdmin, UserRole.Developer])
  }

  private assertCallingPackKind = (kind: string): CallingPackKind => {
    if (kind === 'script' || kind === 'dictionary' || kind === 'voice') return kind
    throw new BadRequestException('kind は script | dictionary | voice のいずれかを指定してください')
  }

  private pickPublishedSnapshotIdField = (
    kind: CallingPackKind,
  ): 'callingScriptSnapshotId' | 'callingDictionarySnapshotId' | 'callingVoiceSnapshotId' => {
    if (kind === 'script') return 'callingScriptSnapshotId'
    if (kind === 'dictionary') return 'callingDictionarySnapshotId'
    return 'callingVoiceSnapshotId'
  }

  getPublishedCallingPacks = async (user: JwtPayload): Promise<PublishedCallingPacks> => {
    const [tenant] = await this.prisma.$queryRaw<
      Array<{
        id: string
        callingScriptSnapshotId: string | null
        callingDictionarySnapshotId: string | null
        callingVoiceSnapshotId: string | null
      }>
    >(Prisma.sql`
      SELECT
        "id",
        "callingScriptSnapshotId",
        "callingDictionarySnapshotId",
        "callingVoiceSnapshotId"
      FROM "tenants"
      WHERE "id" = ${user.tenantId}
      LIMIT 1
    `)
    if (!tenant) throw new BadRequestException('テナントが見つかりません')

    const ids = {
      script: tenant.callingScriptSnapshotId ?? null,
      dictionary: tenant.callingDictionarySnapshotId ?? null,
      voice: tenant.callingVoiceSnapshotId ?? null,
    } as const

    const targetIds = [ids.script, ids.dictionary, ids.voice].filter((x): x is string => Boolean(x))
    const snapshots =
      targetIds.length === 0
        ? []
        : await this.prisma.$queryRaw<
            Array<{
              id: string
              kind: string
              bodyJson: unknown
            }>
          >(Prisma.sql`
            SELECT
              "id",
              "kind",
              "body_json" AS "bodyJson"
            FROM "calling_pack_snapshots"
            WHERE "tenantId" = ${user.tenantId}
              AND "id" IN (${Prisma.join(targetIds)})
          `)

    const byId = new Map(snapshots.map((s) => [s.id, s]))
    const safeBody = (id: string | null): Record<string, unknown> | null => {
      if (!id) return null
      const row = byId.get(id)
      if (!row) return null
      const v = row.bodyJson
      return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
    }

    return {
      tenantId: user.tenantId,
      script: safeBody(ids.script),
      dictionary: safeBody(ids.dictionary),
      voice: safeBody(ids.voice),
      publishedSnapshotIds: ids,
    }
  }

  createCallingPackSnapshot = async (
    user: JwtPayload,
    kindRaw: string,
    bodyJson: Record<string, unknown>,
  ): Promise<{ id: string; kind: CallingPackKind; createdAt: string }> => {
    if (!this.canManageCallingPacks(user)) {
      throw new ForbiddenException('この操作はディレクターまたは管理者のみ可能です')
    }
    const kind = this.assertCallingPackKind(kindRaw)
    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "calling_pack_snapshots" (
        "id",
        "tenantId",
        "kind",
        "body_json",
        "createdAt",
        "createdBy"
      ) VALUES (
        ${id},
        ${user.tenantId},
        ${kind},
        ${bodyJson as Prisma.InputJsonValue}::jsonb,
        ${now},
        ${user.sub}
      )
    `)

    return { id, kind, createdAt: now }
  }

  publishCallingPackSnapshot = async (
    user: JwtPayload,
    kindRaw: string,
    snapshotId: string,
  ): Promise<{ tenantId: string; kind: CallingPackKind; publishedSnapshotId: string }> => {
    if (!this.canManageCallingPacks(user)) {
      throw new ForbiddenException('この操作はディレクターまたは管理者のみ可能です')
    }
    const kind = this.assertCallingPackKind(kindRaw)
    const [row] = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "calling_pack_snapshots"
      WHERE "id" = ${snapshotId}
        AND "tenantId" = ${user.tenantId}
        AND "kind" = ${kind}
      LIMIT 1
    `)
    if (!row) throw new BadRequestException('指定したスナップショットが見つかりません')

    const field = this.pickPublishedSnapshotIdField(kind)
    if (field === 'callingScriptSnapshotId') {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "tenants"
        SET "callingScriptSnapshotId" = ${snapshotId}
        WHERE "id" = ${user.tenantId}
      `)
    } else if (field === 'callingDictionarySnapshotId') {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "tenants"
        SET "callingDictionarySnapshotId" = ${snapshotId}
        WHERE "id" = ${user.tenantId}
      `)
    } else {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "tenants"
        SET "callingVoiceSnapshotId" = ${snapshotId}
        WHERE "id" = ${user.tenantId}
      `)
    }

    return { tenantId: user.tenantId, kind, publishedSnapshotId: snapshotId }
  }
}
