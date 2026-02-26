import { UserRole } from '../enums/user-role.enum';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: UserRole;
  email: string;
}
