import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import MicrosoftProvider from 'next-auth/providers/azure-ad';
import type { AuthResponse, UserRole } from './types';

const apiBaseUrl = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
const DEFAULT_USER_ROLE: UserRole = 'is_member';
const ACCESS_TOKEN_EXPIRES_MS = 24 * 60 * 60 * 1000;
const REFRESH_THRESHOLD_MS = 60 * 1000;

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    error: '/login',
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
          refreshToken: result.refreshToken,
          refreshExpiresAt: result.refreshExpiresAt,
          accessTokenExpiresAt: Date.now() + ACCESS_TOKEN_EXPIRES_MS,
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
    MicrosoftProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID ?? '',
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          scope: 'openid profile email',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      const oauthProviders = ['google', 'azure-ad'];
      if (!account?.provider || !oauthProviders.includes(account.provider)) {
        return true;
      }

      const email =
        (profile as { email?: string })?.email ??
        (user as { email?: string }).email ??
        '';
      const name =
        (profile as { name?: string })?.name ??
        (user as { name?: string }).name ??
        email ??
        '';

      if (!email && account.provider !== 'apple') {
        return false;
      }

      const exchangePath =
        account.provider === 'azure-ad'
          ? 'microsoft'
          : account.provider;
      const response = await fetch(
        `${apiBaseUrl}/auth/${exchangePath}/exchange`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            name,
            provider: account.provider,
          }),
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        return false;
      }

      const result = (await response.json()) as AuthResponse;

      (user as { id?: string }).id = result.user.id;
      user.name = result.user.name;
      user.email = result.user.email;
      (user as { tenantId?: string }).tenantId = result.user.tenantId;
      (user as { role?: UserRole }).role = result.user.role;
      (user as { accessToken?: string }).accessToken = result.accessToken;
      (user as { refreshToken?: string }).refreshToken = result.refreshToken;
      (user as { refreshExpiresAt?: string }).refreshExpiresAt =
        result.refreshExpiresAt;
      (user as { accessTokenExpiresAt?: number }).accessTokenExpiresAt =
        Date.now() + ACCESS_TOKEN_EXPIRES_MS;

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
        token.refreshToken = user.refreshToken;
        token.refreshExpiresAt = user.refreshExpiresAt;
        token.accessTokenExpiresAt = user.accessTokenExpiresAt;
        return token;
      }

      const shouldRefresh =
        token.refreshToken &&
        typeof token.accessTokenExpiresAt === 'number' &&
        Date.now() > token.accessTokenExpiresAt - REFRESH_THRESHOLD_MS;

      if (shouldRefresh) {
        try {
          const res = await fetch(`${apiBaseUrl}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: token.refreshToken }),
            cache: 'no-store',
          });
          if (res.ok) {
            const data = (await res.json()) as AuthResponse;
            token.accessToken = data.accessToken;
            token.accessTokenExpiresAt = Date.now() + ACCESS_TOKEN_EXPIRES_MS;
            token.refreshToken = data.refreshToken ?? token.refreshToken;
            token.refreshExpiresAt = data.refreshExpiresAt ?? token.refreshExpiresAt;
          }
        } catch {
          // ネットワークエラー時はそのまま返す（次回リトライ）
        }
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
