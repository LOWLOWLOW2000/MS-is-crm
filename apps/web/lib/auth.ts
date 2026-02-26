import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import type { AuthResponse, UserRole } from './types';

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';
const DEFAULT_USER_ROLE: UserRole = 'is_member';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const response = await fetch(`${apiBaseUrl}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
          cache: 'no-store',
        });

        if (!response.ok) {
          return null;
        }

        const result = (await response.json()) as AuthResponse;

        return {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          tenantId: result.user.tenantId,
          role: result.user.role,
          accessToken: result.accessToken,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider !== 'google') {
        return true;
      }

      const email = profile?.email ?? user.email;
      const name = profile?.name ?? user.name ?? email ?? '';

      if (!email) {
        return false;
      }

      const response = await fetch(`${apiBaseUrl}/auth/google/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name,
        }),
        cache: 'no-store',
      });

      if (!response.ok) {
        return false;
      }

      const result = (await response.json()) as AuthResponse;

      user.id = result.user.id;
      user.name = result.user.name;
      user.email = result.user.email;
      user.tenantId = result.user.tenantId;
      user.role = result.user.role;
      user.accessToken = result.accessToken;

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        token.tenantId = user.tenantId;
        token.role = user.role;
        token.accessToken = user.accessToken;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.name = token.name ?? '';
        session.user.email = token.email ?? '';
        session.user.tenantId = (token.tenantId as string | undefined) ?? '';
        session.user.role = token.role ?? DEFAULT_USER_ROLE;
      }

      session.accessToken = (token.accessToken as string | undefined) ?? '';
      return session;
    },
  },
};
