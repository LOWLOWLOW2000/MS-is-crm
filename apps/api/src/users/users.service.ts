import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  effectiveRolesFromJwt,
  effectiveRolesFromUserRow,
  primaryRole,
} from '../common/auth/role-utils';
import { UserRole as UR } from '../common/enums/user-role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { upsertProjectMembershipInTx } from './project-membership.helper';
import { toUserListApiRow, type UserListApiRow } from './user-list.mapper';
import { type UpdateMeProfileDto } from './dto/update-me-profile.dto';
import { type UpdateProfileImageDto } from './dto/update-profile-image.dto';

const PROTECTED_ROLES: UR[] = [UR.EnterpriseAdmin, UR.IsAdmin, UR.Developer];

/** GET /users・PATCH tier 共通 select（PJ 配役を同梱） */
const USER_LIST_SELECT = {
  id: true,
  tenantId: true,
  email: true,
  name: true,
  role: true,
  roles: true,
  profileImageUrl: true,
  countryCode: true,
  prefecture: true,
  mobilePhone: true,
  slackId: true,
  departmentName: true,
  createdAt: true,
  projectMemberships: {
    take: 1,
    select: {
      pjRole: true,
      project: { select: { id: true, name: true } },
    },
  },
} as const;

/** GET /users/me 用（hasPassword 算出のため passwordHash を含む） */
const ME_PROFILE_SELECT = {
  ...USER_LIST_SELECT,
  passwordHash: true,
} as const;

const mergeTierIntoRoles = (oldRoles: UR[], box: 'director' | 'is'): UR[] => {
  const protectedPart = oldRoles.filter((r) => PROTECTED_ROLES.includes(r));
  if (box === 'director') {
    const next = [...new Set([...protectedPart, UR.Director])];
    return next.filter((r) => r !== UR.IsMember);
  }
  const next = [...new Set([...protectedPart, UR.IsMember])];
  return next.filter((r) => r !== UR.Director);
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** 自分自身のプロフィール情報（プロフ写真・テナント表示名・PJ配役。PJ変更画面用） */
  getMeProfile = async (jwt: JwtPayload): Promise<{
    id: string
    tenantId: string
    email: string
    name: string
    profileImageUrl: string | null
    role: string
    roles: string[]
    countryCode: string | null
    prefecture: string | null
    mobilePhone: string | null
    slackId: string | null
    departmentName: string | null
    /** メール+パスワードでログイン可能か（OAuth のみなら false） */
    hasPassword: boolean
    tenantCompanyName: string
    tenantProjectName: string
    projectAssignment: UserListApiRow['projectAssignment']
  }> => {
    const [row, tenant] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: jwt.sub, tenantId: jwt.tenantId },
        select: ME_PROFILE_SELECT,
      }),
      this.prisma.tenant.findFirst({
        where: { id: jwt.tenantId },
        select: { companyName: true, projectDisplayName: true, name: true },
      }),
    ])
    if (!row) {
      throw new NotFoundException('ユーザーが見つかりません')
    }
    const { passwordHash, ...userRow } = row
    const mapped = toUserListApiRow(userRow)
    const projectRaw = (tenant?.projectDisplayName ?? '').trim()
    const tenantProjectName = projectRaw.length > 0 ? projectRaw : '未設定'
    const tenantCompanyName = (tenant?.companyName ?? tenant?.name ?? '').trim() || '未設定'
    return {
      id: mapped.id,
      tenantId: mapped.tenantId,
      email: mapped.email,
      name: mapped.name,
      profileImageUrl: mapped.profileImageUrl,
      role: mapped.role,
      roles: mapped.roles,
      countryCode: mapped.countryCode,
      prefecture: mapped.prefecture,
      mobilePhone: mapped.mobilePhone,
      slackId: mapped.slackId,
      departmentName: mapped.departmentName,
      hasPassword: Boolean(passwordHash),
      tenantCompanyName,
      tenantProjectName,
      projectAssignment: mapped.projectAssignment,
    }
  }

  /** 自分自身のプロフィール更新（住所・電話・Slack・表示名） */
  updateMeProfile = async (
    jwt: JwtPayload,
    dto: UpdateMeProfileDto,
  ): Promise<Awaited<ReturnType<UsersService['getMeProfile']>>> => {
    const data: {
      name?: string
      countryCode?: string | null
      prefecture?: string | null
      mobilePhone?: string | null
      slackId?: string | null
      departmentName?: string | null
      updatedAt: string
    } = { updatedAt: new Date().toISOString() }

    if (dto.name !== undefined) {
      const t = dto.name.trim()
      if (t.length === 0) {
        throw new BadRequestException('表示名は空にできません')
      }
      const dup = await this.prisma.user.findFirst({
        where: {
          tenantId: jwt.tenantId,
          name: t,
          NOT: { id: jwt.sub },
        },
        select: { id: true },
      })
      if (dup) {
        throw new ConflictException('同一テナント内でこの表示名は既に使用されています')
      }
      data.name = t
    }
    if (dto.countryCode !== undefined) {
      const raw = dto.countryCode?.trim() ?? ''
      data.countryCode = raw.length === 2 ? raw.toUpperCase() : null
    }
    if (dto.prefecture !== undefined) {
      const t = (dto.prefecture ?? '').trim()
      data.prefecture = t.length > 0 ? t : null
    }
    if (dto.mobilePhone !== undefined) {
      const t = (dto.mobilePhone ?? '').trim()
      data.mobilePhone = t.length > 0 ? t : null
    }
    if (dto.slackId !== undefined) {
      const t = (dto.slackId ?? '').trim()
      data.slackId = t.length > 0 ? t : null
    }
    if (dto.departmentName !== undefined) {
      const t = (dto.departmentName ?? '').trim()
      data.departmentName = t.length > 0 ? t : null
    }

    const keys = Object.keys(data).filter((k) => k !== 'updatedAt')
    if (keys.length === 0) {
      return this.getMeProfile(jwt)
    }

    const owner = await this.prisma.user.findFirst({
      where: { id: jwt.sub, tenantId: jwt.tenantId },
      select: { id: true },
    })
    if (!owner) {
      throw new NotFoundException('ユーザーが見つかりません')
    }

    const { updatedAt, ...patch } = data
    await this.prisma.user.update({
      where: { id: jwt.sub },
      data: { ...patch, updatedAt },
    })
    return this.getMeProfile(jwt)
  }

  /** 自分自身のプロフ写真更新（MVP: dataURL文字列を保存） */
  updateMeProfileImage = async (
    jwt: JwtPayload,
    dto: UpdateProfileImageDto,
  ): Promise<{ profileImageUrl: string | null }> => {
    const raw = dto.profileImageUrl ?? ''
    const next = raw.trim().length === 0 ? null : raw.trim()

    // dataURL以外が来てもDBは保存してしまうため、最低限のガードを入れる
    if (next !== null && !next.startsWith('data:image/')) {
      throw new BadRequestException('画像の形式が不正です')
    }

    const updated = await this.prisma.user.updateMany({
      where: { id: jwt.sub, tenantId: jwt.tenantId },
      data: { profileImageUrl: next },
    })
    if (updated.count === 0) {
      throw new NotFoundException('ユーザーが見つかりません')
    }
    const row = await this.prisma.user.findFirst({
      where: { id: jwt.sub, tenantId: jwt.tenantId },
      select: { profileImageUrl: true },
    })
    return { profileImageUrl: row?.profileImageUrl ?? null }
  }

  getUsers = async (user: JwtPayload): Promise<UserListApiRow[]> => {
    const rows = await this.prisma.user.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'asc' },
      select: USER_LIST_SELECT,
    });
    return rows.map((r) => toUserListApiRow(r));
  };

  /**
   * BOX ドロップ相当: director と is_member のみ切替。enterprise_admin / is_admin / developer は維持。
   * 変更者: enterprise_admin または director（後者は対象に enterprise_admin / is_admin があれば不可）。
   */
  assignTierBox = async (
    jwt: JwtPayload,
    targetUserId: string,
    box: 'director' | 'is',
  ): Promise<UserListApiRow> => {
    const callerRoles = effectiveRolesFromJwt(jwt);
    const callerEa = callerRoles.includes(UR.EnterpriseAdmin);
    const callerDir = callerRoles.includes(UR.Director);
    if (!callerEa && !callerDir) {
      throw new ForbiddenException('企業管理者またはディレクターのみ変更できます');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId: jwt.tenantId },
    });
    if (!target) {
      throw new NotFoundException('ユーザーが見つかりません');
    }

    const targetRoles = effectiveRolesFromUserRow(target);
    if (!callerEa) {
      if (targetRoles.includes(UR.EnterpriseAdmin)) {
        throw new ForbiddenException('企業管理者のロールは企業管理者のみ変更できます');
      }
      if (targetRoles.includes(UR.IsAdmin)) {
        throw new ForbiddenException('IS管理者のロールは企業管理者のみ変更できます');
      }
      if (targetRoles.includes(UR.Developer)) {
        throw new ForbiddenException('開発者ロールのユーザーは企業管理者のみ変更できます');
      }
    }

    const nextRoles = mergeTierIntoRoles(targetRoles, box);
    if (nextRoles.length === 0) {
      throw new BadRequestException('ロールが空になるため更新できません');
    }

    const pr = primaryRole(nextRoles);
    const now = new Date().toISOString();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: {
          roles: nextRoles as unknown as string[],
          role: pr,
          updatedAt: now,
        },
      });
      await upsertProjectMembershipInTx(tx, {
        tenantId: jwt.tenantId,
        userId: targetUserId,
        roles: nextRoles,
      });
    });

    const row = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId: jwt.tenantId },
      select: USER_LIST_SELECT,
    });
    if (!row) {
      throw new NotFoundException('更新後のユーザー取得に失敗しました');
    }
    return toUserListApiRow(row);
  };

  /**
   * 既定PJから外す: project_memberships のみ削除（User.roles は維持）
   *
   * PJメンバー一覧は project_memberships（projectAssignment）で表示同期するため、
   * User.roles の director / is_member を無理に外さずに済ませる。
   */
  removeUserFromProject = async (
    jwt: JwtPayload,
    targetUserId: string,
  ): Promise<UserListApiRow> => {
    const callerRoles = effectiveRolesFromJwt(jwt);
    const callerEa = callerRoles.includes(UR.EnterpriseAdmin);
    const callerDir = callerRoles.includes(UR.Director);
    if (!callerEa && !callerDir) {
      throw new ForbiddenException('企業管理者またはディレクターのみ実行できます');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId: jwt.tenantId },
    });
    if (!target) {
      throw new NotFoundException('ユーザーが見つかりません');
    }

    const targetRoles = effectiveRolesFromUserRow(target);
    if (targetRoles.includes(UR.EnterpriseAdmin)) {
      throw new ForbiddenException('企業管理者はPJからサインアウトできません');
    }
    if (!callerEa) {
      if (targetRoles.includes(UR.IsAdmin)) {
        throw new ForbiddenException('IS管理者の配役は企業管理者のみ変更できます');
      }
      if (targetRoles.includes(UR.Developer)) {
        throw new ForbiddenException('開発者の配役は企業管理者のみ変更できます');
      }
    }

    const deleteResult = await this.prisma.$transaction(async (tx) => {
      return tx.projectMembership.deleteMany({
        where: { tenantId: jwt.tenantId, userId: targetUserId },
      })
    })

    const row = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId: jwt.tenantId },
      select: USER_LIST_SELECT,
    });
    if (!row) {
      throw new NotFoundException('更新後のユーザー取得に失敗しました');
    }
    const apiRow = toUserListApiRow(row)
    // #region agent log
    fetch('http://127.0.0.1:7314/ingest/76c3a999-78a8-4303-8f64-4e64935f7100', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'e715e7',
      },
      body: JSON.stringify({
        sessionId: 'e715e7',
        hypothesisId: 'PJ-REMOVE',
        location: 'users.service.ts:removeUserFromProject',
        message: 'deleteMany(project_memberships)',
        data: {
          tenantId: jwt.tenantId,
          targetUserId,
          deletedCount: deleteResult.count,
          projectAssignmentAfter: apiRow.projectAssignment,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    return apiRow;
  };
}
