import { UserRole } from '../../common/enums/user-role.enum';

export interface AuthUser {
  id: string;
  tenantId: string;
  /** 主ロール（JWT の role フィールド用） */
  role: UserRole;
  /** 複数ロール */
  roles: UserRole[];
  email: string;
  name: string;
  passwordHash?: string;
}
