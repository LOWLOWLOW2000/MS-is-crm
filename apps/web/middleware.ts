import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * 招待リンク初回アクセス時はログインへ誘導する。
 * パスワード未設定の新規招待のみ `/invite/accept?...&continueInvite=1` で参加フォームへ戻る。
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname !== '/invite/accept') {
    return NextResponse.next()
  }

  if (request.nextUrl.searchParams.get('continueInvite') === '1') {
    return NextResponse.next()
  }

  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret,
  })

  if (token) {
    return NextResponse.next()
  }

  const callbackPath = `${pathname}${request.nextUrl.search}`
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('callbackUrl', callbackPath)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/invite/accept'],
}
