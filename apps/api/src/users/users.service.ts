import {
  BadRequestException,
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
  createdAt: true,
  projectMemberships: {
    take: 1,
    select: {
      pjRole: true,
      project: { select: { id: true, name: true } },
    },
  },
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

  /** 既定PJから外す: project_memberships のみ削除（ロールは維持） */
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
      throw new ForbiddenException('企業管理者はPJから除名できません');
    }
    if (!callerEa) {
      if (targetRoles.includes(UR.IsAdmin)) {
        throw new ForbiddenException('IS管理者の配役は企業管理者のみ変更できます');
      }
      if (targetRoles.includes(UR.Developer)) {
        throw new ForbiddenException('開発者の配役は企業管理者のみ変更できます');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.projectMembership.deleteMany({
        where: { tenantId: jwt.tenantId, userId: targetUserId },
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
}
