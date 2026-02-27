import { UserRole } from '../../common/enums/user-role.enum';

export class AuthResponseDto {
  accessToken!: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
  user!: {
    id: string;
    tenantId: string;
    role: UserRole;
    email: string;
    name: string;
  };
}
