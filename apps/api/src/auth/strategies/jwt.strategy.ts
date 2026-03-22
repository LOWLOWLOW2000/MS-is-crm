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
