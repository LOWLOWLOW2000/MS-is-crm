import { UserRole } from '../enums/user-role.enum';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  /** 主ロール（後方互換・単一チェック用） */
  role: UserRole;
  /** 複数ロール（空のときは role のみ） */
  roles?: UserRole[];
  email: string;
}
