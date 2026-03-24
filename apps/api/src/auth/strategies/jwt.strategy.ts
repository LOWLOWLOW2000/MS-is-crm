import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { effectiveRolesFromUserRow, primaryRole } from '../../common/auth/role-utils';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'change-me-in-env'),
    });
  }

  /**
   * アクセストークン内の roles は発行時点のスナップショットのため、
   * 毎リクエスト DB から再取得して権限と整合させる（再ログインなしで反映）。
   */
  validate = async (payload: JwtPayload): Promise<JwtPayload> => {
    const row = await this.prisma.user.findFirst({
      where: { id: payload.sub, tenantId: payload.tenantId },
      select: { id: true, tenantId: true, email: true, role: true, roles: true },
    });
    if (!row) {
      // #region agent log
      fetch('http://127.0.0.1:7694/ingest/2c3781ca-fbdf-4289-a7bb-2c29cef5514a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a931fb' },
        body: JSON.stringify({
          sessionId: 'a931fb',
          location: 'jwt.strategy.ts:validate',
          message: 'jwt validate user row missing',
          data: {
            hypothesisId: 'H3',
            subLength: payload.sub?.length ?? 0,
            tenantIdLength: payload.tenantId?.length ?? 0,
          },
          timestamp: Date.now(),
          runId: 'pre-fix',
        }),
      }).catch(() => {})
      // #endregion
      // Seed 再実行で user.id が変わり、古い JWT の sub が参照切れになるケースに対応
      const fallbackRow = await this.prisma.user.findFirst({
        where: { email: payload.email, tenantId: payload.tenantId },
        select: { id: true, tenantId: true, email: true, role: true, roles: true },
      });
      if (fallbackRow) {
        const eff = effectiveRolesFromUserRow(fallbackRow);
        // #region agent log
        fetch('http://127.0.0.1:7694/ingest/2c3781ca-fbdf-4289-a7bb-2c29cef5514a', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a931fb' },
          body: JSON.stringify({
            sessionId: 'a931fb',
            location: 'jwt.strategy.ts:validate',
            message: 'jwt validate fallback by email success',
            data: {
              hypothesisId: 'H3-fallback',
              subLength: fallbackRow.id?.length ?? 0,
              tenantIdLength: fallbackRow.tenantId?.length ?? 0,
            },
            timestamp: Date.now(),
            runId: 'pre-fix',
          }),
        }).catch(() => {})
        // #endregion
        return {
          sub: fallbackRow.id,
          tenantId: fallbackRow.tenantId,
          role: primaryRole(eff),
          roles: eff,
          email: fallbackRow.email,
        };
      }

      throw new UnauthorizedException();
    }
    const eff = effectiveRolesFromUserRow(row);
    return {
      sub: row.id,
      tenantId: row.tenantId,
      role: primaryRole(eff),
      roles: eff,
      email: row.email,
    };
  };
}
