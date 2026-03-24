import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // #region agent log
  handleRequest<TUser = unknown>(
    err: Error | undefined,
    user: TUser | false,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    const req = context.switchToHttp().getRequest() as {
      method?: string
      url?: string
      headers?: { authorization?: string }
    }
    const authHeader = typeof req.headers?.authorization === 'string' ? req.headers.authorization : ''
    const bearerPresent = authHeader.startsWith('Bearer ')
    const tokenLen = bearerPresent ? authHeader.slice(7).trim().length : 0
    const infoMsg =
      info && typeof info === 'object' && info !== null && 'message' in info
        ? String((info as { message: unknown }).message).slice(0, 160)
        : ''
    if (err || !user) {
      fetch('http://127.0.0.1:7694/ingest/2c3781ca-fbdf-4289-a7bb-2c29cef5514a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a931fb' },
        body: JSON.stringify({
          sessionId: 'a931fb',
          location: 'jwt-auth.guard.ts:handleRequest',
          message: 'jwt auth failed',
          data: {
            hypothesisId: 'H1-H2-H4-H5',
            method: req.method ?? '',
            url: req.url ?? '',
            hasBearer: bearerPresent,
            tokenLength: tokenLen,
            errName: err?.name ?? null,
            errMessage: err?.message ? String(err.message).slice(0, 160) : null,
            infoMessage: infoMsg,
          },
          timestamp: Date.now(),
          runId: 'pre-fix',
        }),
      }).catch(() => {})
    }
    return super.handleRequest(err, user, info, context, status) as TUser
  }
  // #endregion
}
