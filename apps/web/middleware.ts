import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { UserRole } from '@/lib/types';

const LOGIN_PATH = '/login';
const DASHBOARD_PATH = '/dashboard';
const CALLING_PATH = '/calling';
const DIRECTOR_PATH = '/director';

const isProtectedPath = (pathname: string): boolean => {
  return (
    pathname.startsWith(DASHBOARD_PATH) ||
    pathname.startsWith(CALLING_PATH) ||
    pathname.startsWith(DIRECTOR_PATH)
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

  return NextResponse.next();
};

export const config = {
  matcher: ['/login', '/dashboard/:path*', '/calling/:path*', '/director/:path*'],
};
