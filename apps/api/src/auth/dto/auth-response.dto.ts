import { UserRole } from '../../common/enums/user-role.enum';

export class AuthResponseDto {
  accessToken!: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
  user!: {
    id: string;
    tenantId: string;
    role: UserRole;
    roles: UserRole[];
    email: string;
    name: string;
    /** Tenant.companyName を優先、なければ Tenant.name */
    tenantCompanyName: string;
    /** Tenant.projectDisplayName（未設定時は API 側で「未設定」） */
    tenantProjectName: string;
  };
}
