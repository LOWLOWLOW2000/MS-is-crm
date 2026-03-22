import { UserRole } from '../enums/user-role.enum';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

const ROLE_PRIORITY: UserRole[] = [
  UserRole.Developer,
  UserRole.EnterpriseAdmin,
  UserRole.IsAdmin,
  UserRole.Director,
  UserRole.IsMember,
];

/** JWT / DB 行から実効ロール一覧を得る */
export const effectiveRolesFromJwt = (payload: JwtPayload): UserRole[] => {
  if (payload.roles && payload.roles.length > 0) {
    return payload.roles;
  }
  if (payload.role) {
    return [payload.role];
  }
  return [];
};

/** DB の role + roles 列から UserRole[] を組み立てる */
export const effectiveRolesFromUserRow = (row: {
  role: string;
  roles: string[];
}): UserRole[] => {
  if (row.roles && row.roles.length > 0) {
    return row.roles as UserRole[];
  }
  return [row.role as UserRole];
};

/** 表示・後方互換用の主ロール（最も強い権限を1つ） */
export const primaryRole = (roles: UserRole[]): UserRole => {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) {
      return r;
    }
  }
  return roles[0] ?? UserRole.IsMember;
};

export const hasRole = (payload: JwtPayload, role: UserRole): boolean =>
  effectiveRolesFromJwt(payload).includes(role);

export const hasAnyRole = (payload: JwtPayload, check: UserRole[]): boolean =>
  check.some((r) => hasRole(payload, r));

/**
 * リスト管理等が禁止される「IS メンバー専用」相当か。
 * ディレクター以上が1つでもあれば false。
 */
export const isRestrictedMember = (payload: JwtPayload): boolean =>
  hasRole(payload, UserRole.IsMember) &&
  !hasAnyRole(payload, [
    UserRole.Developer,
    UserRole.EnterpriseAdmin,
    UserRole.IsAdmin,
    UserRole.Director,
  ]);
