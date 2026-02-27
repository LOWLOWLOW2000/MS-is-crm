import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuthUser } from './entities/auth-user.entity';
import { GoogleAuthProfile } from './strategies/google.strategy';

const REFRESH_TOKEN_EXPIRES_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private toAuthUser(row: { id: string; tenantId: string; email: string; name: string; role: string }): AuthUser {
    return {
      id: row.id,
      tenantId: row.tenantId,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
    };
  }

  private toPayload(user: AuthUser): JwtPayload {
    return {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    };
  }

  private sign(user: AuthUser): string {
    return this.jwtService.sign(this.toPayload(user));
  }

  private hashRefreshToken(plain: string): string {
    return createHash('sha256').update(plain).digest('hex');
  }

  private generateRefreshToken(): { plain: string; hash: string } {
    const plain = randomBytes(32).toString('hex');
    return { plain, hash: this.hashRefreshToken(plain) };
  }

  private refreshExpiresAt(): string {
    const d = new Date();
    d.setDate(d.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
    return d.toISOString();
  }

  private async createRefreshTokenForUser(userId: string, tenantId: string): Promise<{ refreshToken: string; refreshExpiresAt: string }> {
    const now = new Date().toISOString();
    const expiresAt = this.refreshExpiresAt();
    const { plain, hash } = this.generateRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tenantId,
        tokenHash: hash,
        expiresAt,
        createdAt: now,
      },
    });

    return { refreshToken: plain, refreshExpiresAt: expiresAt };
  }

  private async toResponse(user: AuthUser, includeRefresh = true): Promise<{
    accessToken: string;
    refreshToken?: string;
    refreshExpiresAt?: string;
    user: { id: string; tenantId: string; role: UserRole; email: string; name: string };
  }> {
    const base = {
      accessToken: this.sign(user),
      user: {
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
        name: user.name,
      },
    };

    if (!includeRefresh) {
      return base;
    }

    const { refreshToken, refreshExpiresAt } = await this.createRefreshTokenForUser(user.id, user.tenantId);
    return { ...base, refreshToken, refreshExpiresAt };
  }

  async loginWithPassword(loginDto: LoginDto): Promise<ReturnType<AuthService['toResponse']>> {
    const row = await this.prisma.user.findFirst({
      where: { email: loginDto.email },
    });

    if (!row?.passwordHash) {
      throw new UnauthorizedException('メールまたはパスワードが正しくありません');
    }

    const isMatched = await bcrypt.compare(loginDto.password, row.passwordHash);
    if (!isMatched) {
      throw new UnauthorizedException('メールまたはパスワードが正しくありません');
    }

    const user = this.toAuthUser(row);
    return this.toResponse(user);
  }

  async loginWithGoogle(profile: GoogleAuthProfile): Promise<ReturnType<AuthService['toResponse']>> {
    const existing = await this.prisma.user.findFirst({
      where: { email: profile.email },
    });

    if (existing) {
      return this.toResponse(this.toAuthUser(existing));
    }

    const tenantId = this.resolveTenantId(profile.email);
    const now = new Date().toISOString();
    const newRow = await this.prisma.user.create({
      data: {
        tenantId,
        email: profile.email,
        name: profile.name ?? profile.email,
        role: UserRole.IsMember,
        createdAt: now,
        updatedAt: now,
      },
    });

    return this.toResponse(this.toAuthUser(newRow));
  }

  async getProfile(payload: JwtPayload): Promise<{ id: string; tenantId: string; role: UserRole; email: string; name: string }> {
    const row = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!row) {
      throw new NotFoundException('ユーザーが見つかりません');
    }

    return {
      id: row.id,
      tenantId: row.tenantId,
      role: row.role as UserRole,
      email: row.email,
      name: row.name,
    };
  }

  /** Refresh Token で新しい accessToken と refreshToken を発行する。古い refresh は削除（ローテーション）。 */
  async refreshTokens(refreshTokenPlain: string): Promise<ReturnType<AuthService['toResponse']>> {
    const hash = this.hashRefreshToken(refreshTokenPlain);
    const now = new Date().toISOString();

    const tokenRow = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: hash },
      include: { user: true },
    });

    if (!tokenRow || tokenRow.expiresAt < now) {
      throw new UnauthorizedException('リフレッシュトークンが無効または期限切れです');
    }

    await this.prisma.refreshToken.delete({ where: { id: tokenRow.id } });

    const user = this.toAuthUser(tokenRow.user);
    return this.toResponse(user);
  }

  private resolveTenantId(email: string): string {
    const [, domain] = email.split('@');
    if (!domain) {
      return 'tenant-demo-01';
    }
    return `tenant-${domain.replace(/\./g, '-')}`;
  }
}
