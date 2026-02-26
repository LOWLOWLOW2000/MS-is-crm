import { UserRole } from '../../common/enums/user-role.enum';

export class AuthResponseDto {
  accessToken!: string;
  user!: {
    id: string;
    tenantId: string;
    role: UserRole;
    email: string;
    name: string;
  };
}
