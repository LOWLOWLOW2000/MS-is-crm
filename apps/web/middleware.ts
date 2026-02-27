import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { UserRole } from '@/lib/types';

const LOGIN_PATH = '/login';
const DASHBOARD_PATH = '/dashboard';
const CALLING_PATH = '/calling';
const DIRECTOR_PATH = '/director';
const LISTS_PATH = '/lists';
const REPORTS_PATH = '/reports';
const SETTINGS_PATH = '/settings';
const RECALL_PATH = '/recall';
const SCRIPTS_PATH = '/scripts';

const isProtectedPath = (pathname: string): boolean => {
  return (
    pathname.startsWith(DASHBOARD_PATH) ||
    pathname.startsWith(CALLING_PATH) ||
    pathname.startsWith(DIRECTOR_PATH) ||
    pathname.startsWith(LISTS_PATH) ||
    pathname.startsWith(REPORTS_PATH) ||
    pathname.startsWith(SETTINGS_PATH) ||
    pathname.startsWith(RECALL_PATH) ||
    pathname.startsWith(SCRIPTS_PATH)
  );
};

const getRedirectPathByRole = (role: UserRole | undefined): string => {
  if (role === 'is_member') {
    return CALLING_PATH;
  }

  return DASHBOARD_PATH;
};

export const middleware = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request });
  const isAuthenticated = Boolean(token);
  const userRole = token?.role;
  const redirectPath = getRedirectPathByRole(userRole);

  if (!isAuthenticated && isProtectedPath(pathname)) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && pathname === LOGIN_PATH) {
    const url = new URL(redirectPath, request.url);
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && pathname.startsWith(DASHBOARD_PATH) && userRole === 'is_member') {
    const url = new URL(CALLING_PATH, request.url);
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && pathname.startsWith(CALLING_PATH) && userRole !== 'is_member') {
    const url = new URL(DASHBOARD_PATH, request.url);
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && pathname.startsWith(DIRECTOR_PATH) && userRole === 'is_member') {
    const url = new URL(CALLING_PATH, request.url);
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && pathname.startsWith(LISTS_PATH) && userRole === 'is_member') {
    const url = new URL(CALLING_PATH, request.url);
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && pathname.startsWith(REPORTS_PATH) && userRole === 'is_member') {
    const url = new URL(CALLING_PATH, request.url);
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && pathname.startsWith(SETTINGS_PATH) && userRole === 'is_member') {
    const url = new URL(CALLING_PATH, request.url);
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && pathname.startsWith(RECALL_PATH) && userRole === 'is_member') {
    const url = new URL(CALLING_PATH, request.url);
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && pathname.startsWith(SCRIPTS_PATH) && userRole === 'is_member') {
    const url = new URL(CALLING_PATH, request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
};

export const config = {
  matcher: [
    '/login',
    '/dashboard/:path*',
    '/calling/:path*',
    '/director/:path*',
    '/lists/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/recall/:path*',
    '/scripts/:path*',
  ],
};
