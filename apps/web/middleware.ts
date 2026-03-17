import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * UI ゼロ状態: ルートのみ対象。認証・リダイレクトは作り直し時に追加する。
 */
export const middleware = async (request: NextRequest) => {
  return NextResponse.next();
};

export const config = {
  matcher: [],
};
