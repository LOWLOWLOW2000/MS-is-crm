import type { DefaultSession } from 'next-auth';
import { UserRole } from '@/lib/types';

declare module 'next-auth' {
  /** next-auth@4.24 実行時はあるが @types に無いことがある */
  interface AuthOptions {
    trustHost?: boolean;
  }

  interface Session {
    accessToken: string;
    user: {
      id: string;
      tenantId: string;
      role: UserRole;
      roles: UserRole[];
      tenantCompanyName: string;
      tenantProjectName: string;
    } & DefaultSession['user'];
  }

  interface User {
    tenantId: string;
    role: UserRole;
    roles: UserRole[];
    tenantCompanyName: string;
    tenantProjectName: string;
    accessToken: string;
    refreshToken?: string;
    refreshExpiresAt?: string;
    accessTokenExpiresAt?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    tenantId?: string;
    role?: UserRole;
    roles?: UserRole[];
    tenantCompanyName?: string;
    tenantProjectName?: string;
    accessToken?: string;
    refreshToken?: string;
    refreshExpiresAt?: string;
    accessTokenExpiresAt?: number;
  }
}
