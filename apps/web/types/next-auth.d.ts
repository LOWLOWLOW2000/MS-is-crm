import { DefaultSession } from 'next-auth';
import { UserRole } from '@/lib/types';

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    user: {
      id: string;
      tenantId: string;
      role: UserRole;
    } & DefaultSession['user'];
  }

  interface User {
    tenantId: string;
    role: UserRole;
    accessToken: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    tenantId?: string;
    role?: UserRole;
    accessToken?: string;
  }
}
