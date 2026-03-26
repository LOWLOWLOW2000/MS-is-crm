import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { effectiveRolesFromUserRow, primaryRole } from '../common/auth/role-utils';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { upsertProjectMembershipInTx } from '../users/project-membership.helper';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { AuthUser } from './entities/auth-user.entity';
import { GoogleAuthProfile } from './strategies/google.strategy';

const REFRESH_TOKEN_EXPIRES_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private toAuthUser(row: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    role: string;
    roles: string[];
  }): AuthUser {
    const roles = effectiveRolesFromUserRow(row);
    return {
      id: row.id,
      tenantId: row.tenantId,
      email: row.email,
      name: row.name,
      roles,
      role: primaryRole(roles),
    };
  }

  private toPayload(user: AuthUser): JwtPayload {
    return {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      roles: user.roles,
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

  /** ヘッダー用：所属企業名・PJ表示名（テナント未登録や空は「未設定」） */
  private async tenantHeaderFields(tenantId: string): Promise<{
    tenantCompanyName: string;
    tenantProjectName: string;
  }> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { companyName: true, name: true, projectDisplayName: true },
    });
    const companyRaw = (t?.companyName ?? t?.name ?? '').trim();
    const projectRaw = (t?.projectDisplayName ?? '').trim();
    return {
      tenantCompanyName: companyRaw.length > 0 ? companyRaw : '未設定',
      tenantProjectName: projectRaw.length > 0 ? projectRaw : '未設定',
    };
  }

  private async toResponse(user: AuthUser, includeRefresh = true): Promise<{
    accessToken: string;
    refreshToken?: string;
    refreshExpiresAt?: string;
    user: {
      id: string;
      tenantId: string;
      role: UserRole;
      roles: UserRole[];
      email: string;
      name: string;
      tenantCompanyName: string;
      tenantProjectName: string;
    };
  }> {
    const { tenantCompanyName, tenantProjectName } = await this.tenantHeaderFields(user.tenantId);
    const base = {
      accessToken: this.sign(user),
      user: {
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        roles: user.roles,
        email: user.email,
        name: user.name,
        tenantCompanyName,
        tenantProjectName,
      },
    };

    if (!includeRefresh) {
      return base;
    }

    const { refreshToken, refreshExpiresAt } = await this.createRefreshTokenForUser(user.id, user.tenantId);
    return { ...base, refreshToken, refreshExpiresAt };
  }

  /** 招待承諾後など、ユーザー ID からトークン一式を発行 */
  async issueTokensForUser(userId: string): Promise<Awaited<ReturnType<AuthService['toResponse']>>> {
    const row = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!row) {
      throw new NotFoundException('ユーザーが見つかりません');
    }
    return this.toResponse(this.toAuthUser(row));
  }

  /** 初回企業作成：テナント＋企業管理者＋ディレクター */
  async registerCompany(dto: RegisterCompanyDto): Promise<Awaited<ReturnType<AuthService['toResponse']>>> {
    const emailNorm = dto.email.trim().toLowerCase();
    const domain = (emailNorm.split('@')[1] ?? '').trim().toLowerCase()
    const blockedDomains = new Set([
      'gmail.com',
      'googlemail.com',
      'yahoo.com',
      'yahoo.co.jp',
      'outlook.com',
      'hotmail.com',
      'live.com',
      'icloud.com',
      'aol.com',
      'proton.me',
      'protonmail.com',
    ])
    if (domain.length === 0) {
      throw new BadRequestException('メールアドレスの形式が正しくありません')
    }
    if (blockedDomains.has(domain)) {
      throw new BadRequestException('企業管理者のIDは企業ドメインのメールアドレスを指定してください（フリーメール不可）')
    }
    const dup = await this.prisma.user.findFirst({
      where: { email: emailNorm },
    });
    if (dup) {
      throw new ConflictException('このメールアドレスは既に登録されています');
    }

    // 企業アカウント管理者は「IS側ルール」に寄せる（director混入を防ぐ）
    const roles: UserRole[] = [UserRole.EnterpriseAdmin];
    const pr = primaryRole(roles);
    const now = new Date().toISOString();
    const passwordHash =
      dto.password && dto.password.length > 0
        ? await bcrypt.hash(dto.password, 10)
        : null;

    const user = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          companyName: dto.companyName,
          headOfficeAddress: dto.headOfficeAddress,
          headOfficePhone: dto.headOfficePhone,
          representativeName: dto.representativeName,
          accountStatus: 'active',
          createdAt: now,
          updatedAt: now,
        },
      });

      await tx.legalEntity.create({
        data: {
          tenantId: tenant.id,
          name: dto.companyName,
          headOfficeAddress: dto.headOfficeAddress,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        },
      })

      const u = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: emailNorm,
          name: dto.name,
          passwordHash,
          role: pr,
          roles: roles as unknown as string[],
          createdAt: now,
          updatedAt: now,
        },
      });
      await upsertProjectMembershipInTx(tx, {
        tenantId: tenant.id,
        userId: u.id,
        roles,
      });
      return u;
    });

    return this.toResponse(this.toAuthUser(user));
  }

  async loginWithPassword(loginDto: LoginDto): Promise<Awaited<ReturnType<AuthService['toResponse']>>> {
    const row = await this.prisma.user.findFirst({
      where: { email: loginDto.email.trim().toLowerCase() },
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

  async loginWithGoogle(profile: GoogleAuthProfile): Promise<Awaited<ReturnType<AuthService['toResponse']>>> {
    const emailNorm = profile.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { email: emailNorm },
    });

    if (existing) {
      return this.toResponse(this.toAuthUser(existing));
    }

    const tenantId = this.resolveTenantId(profile.email);
    const now = new Date().toISOString();
    const roles: UserRole[] = [UserRole.IsMember];
    const newRow = await this.prisma.$transaction(async (tx) => {
      const row = await tx.user.create({
        data: {
          tenantId,
          email: emailNorm,
          name: profile.name ?? profile.email,
          role: UserRole.IsMember,
          roles: roles as unknown as string[],
          createdAt: now,
          updatedAt: now,
        },
      });
      await upsertProjectMembershipInTx(tx, {
        tenantId,
        userId: row.id,
        roles,
      });
      return row;
    });

    return this.toResponse(this.toAuthUser(newRow));
  }

  /**
   * メール+パスワード利用者のパスワード変更。成功後は既存 refresh を失効（再ログイン推奨）。
   */
  async changePassword(
    payload: JwtPayload,
    dto: ChangePasswordDto,
  ): Promise<{ ok: true }> {
    const row = await this.prisma.user.findFirst({
      where: { id: payload.sub, tenantId: payload.tenantId },
    });
    if (!row) {
      throw new NotFoundException('ユーザーが見つかりません');
    }
    if (!row.passwordHash) {
      throw new BadRequestException(
        'パスワードが未設定のため変更できません（OAuth のみでログインしている場合はパスワードを設定できません）',
      );
    }
    const matched = await bcrypt.compare(dto.currentPassword, row.passwordHash);
    if (!matched) {
      throw new UnauthorizedException('現在のパスワードが正しくありません');
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('新しいパスワードは現在と異なる値にしてください');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    const now = new Date().toISOString();
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { userId: row.id } });
      await tx.user.update({
        where: { id: row.id },
        data: { passwordHash, updatedAt: now },
      });
    });
    return { ok: true };
  }

  async getProfile(payload: JwtPayload): Promise<{
    id: string;
    tenantId: string;
    role: UserRole;
    roles: UserRole[];
    email: string;
    name: string;
  }> {
    const row = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!row) {
      throw new NotFoundException('ユーザーが見つかりません');
    }

    const roles = effectiveRolesFromUserRow(row);
    return {
      id: row.id,
      tenantId: row.tenantId,
      role: primaryRole(roles),
      roles,
      email: row.email,
      name: row.name,
    };
  }

  /** Refresh Token で新しい accessToken と refreshToken を発行する。古い refresh は削除（ローテーション）。 */
  async refreshTokens(refreshTokenPlain: string): Promise<Awaited<ReturnType<AuthService['toResponse']>>> {
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
