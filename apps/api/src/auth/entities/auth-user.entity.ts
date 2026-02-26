import { UserRole } from '../../common/enums/user-role.enum';

export interface AuthUser {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
  name: string;
  passwordHash?: string;
}
