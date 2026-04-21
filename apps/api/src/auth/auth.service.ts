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

  /**
   * メールはテナント単位で一意のため、同一アドレスが複数テナントに存在し得る。
   * `findFirst` だと照合対象が不定になるため、パスワードが一致する行を列挙して確定する。
   */
  async loginWithPassword(loginDto: LoginDto): Promise<Awaited<ReturnType<AuthService['toResponse']>>> {
    const emailNorm = loginDto.email.trim().toLowerCase();
    const rows = await this.prisma.user.findMany({
      where: { email: emailNorm },
      orderBy: { tenantId: 'asc' },
    });

    const matched: typeof rows = [];
    for (const row of rows) {
      if (!row.passwordHash) {
        continue;
      }
      const ok = await bcrypt.compare(loginDto.password, row.passwordHash);
      if (ok) {
        matched.push(row);
      }
    }

    if (matched.length === 0) {
      throw new UnauthorizedException('メールまたはパスワードが正しくありません');
    }

    const row =
      matched.length === 1
        ? matched[0]!
        : [...matched].sort((a, b) => a.tenantId.localeCompare(b.tenantId))[0]!;
    const user = this.toAuthUser(row);
    return this.toResponse(user);
  }

  async loginWithGoogle(profile: GoogleAuthProfile): Promise<Awaited<ReturnType<AuthService['toResponse']>>> {
    const emailNorm = profile.email.trim().toLowerCase();
    // #region agent log
    fetch('http://127.0.0.1:7788/ingest/76c3a999-78a8-4303-8f64-4e64935f7100',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c49aa'},body:JSON.stringify({sessionId:'3c49aa',runId:'pre-fix',hypothesisId:'H10',location:'apps/api/src/auth/auth.service.ts:loginWithGoogle:entry',message:'loginWithGoogle entry',data:{emailLength:emailNorm.length,hasName:typeof profile.name==='string'&&profile.name.length>0},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    let existing: {
      id: string
      tenantId: string
      email: string
      name: string
      role: string
      roles: string[]
    } | null = null
    try {
      existing = await this.prisma.user.findFirst({
        where: { email: emailNorm },
        select: { id: true, tenantId: true, email: true, name: true, role: true, roles: true },
      });
      // #region agent log
      fetch('http://127.0.0.1:7788/ingest/76c3a999-78a8-4303-8f64-4e64935f7100',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c49aa'},body:JSON.stringify({sessionId:'3c49aa',runId:'pre-fix',hypothesisId:'H10',location:'apps/api/src/auth/auth.service.ts:loginWithGoogle:afterFindExisting',message:'after findFirst user by email',data:{found:existing!=null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    } catch (e) {
      // #region agent log
      const code =
        e && typeof e === 'object' && e !== null && 'code' in e
          ? String((e as { code?: unknown }).code)
          : null
      fetch('http://127.0.0.1:7788/ingest/76c3a999-78a8-4303-8f64-4e64935f7100',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c49aa'},body:JSON.stringify({sessionId:'3c49aa',runId:'pre-fix',hypothesisId:'H10',location:'apps/api/src/auth/auth.service.ts:loginWithGoogle:findExistingError',message:'findFirst user by email failed',data:{errorName:e instanceof Error?e.name:'<non-error>',errorMessage:e instanceof Error?e.message:'<non-error>',code},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      throw e
    }

    if (existing) {
      // #region agent log
      fetch('http://127.0.0.1:7788/ingest/76c3a999-78a8-4303-8f64-4e64935f7100',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c49aa'},body:JSON.stringify({sessionId:'3c49aa',runId:'pre-fix',hypothesisId:'H4',location:'apps/api/src/auth/auth.service.ts:loginWithGoogle:existing',message:'loginWithGoogle existing user',data:{tenantId:existing.tenantId,userIdPresent:typeof existing.id==='string'&&existing.id.length>0},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return this.toResponse(this.toAuthUser(existing))
    }

    const computedTenantId = this.resolveTenantId(profile.email)
    let tenantExists: { id: string } | null = null
    try {
      tenantExists = await this.prisma.tenant.findUnique({
        where: { id: computedTenantId },
        select: { id: true },
      })
      // #region agent log
      fetch('http://127.0.0.1:7788/ingest/76c3a999-78a8-4303-8f64-4e64935f7100',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c49aa'},body:JSON.stringify({sessionId:'3c49aa',runId:'pre-fix',hypothesisId:'H10',location:'apps/api/src/auth/auth.service.ts:loginWithGoogle:afterFindTenant',message:'after findUnique tenant',data:{computedTenantId,tenantFound:tenantExists!=null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    } catch (e) {
      // #region agent log
      const code =
        e && typeof e === 'object' && e !== null && 'code' in e
          ? String((e as { code?: unknown }).code)
          : null
      fetch('http://127.0.0.1:7788/ingest/76c3a999-78a8-4303-8f64-4e64935f7100',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c49aa'},body:JSON.stringify({sessionId:'3c49aa',runId:'pre-fix',hypothesisId:'H10',location:'apps/api/src/auth/auth.service.ts:loginWithGoogle:findTenantError',message:'findUnique tenant failed',data:{computedTenantId,errorName:e instanceof Error?e.name:'<non-error>',errorMessage:e instanceof Error?e.message:'<non-error>',code},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      throw e
    }
    const tenantId = computedTenantId
    // #region agent log
    fetch('http://127.0.0.1:7788/ingest/76c3a999-78a8-4303-8f64-4e64935f7100',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c49aa'},body:JSON.stringify({sessionId:'3c49aa',runId:'pre-fix',hypothesisId:'H4',location:'apps/api/src/auth/auth.service.ts:loginWithGoogle:tenantResolution',message:'loginWithGoogle tenant resolution',data:{computedTenantId,tenantExists:tenantExists!=null,chosenTenantId:tenantId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const now = new Date().toISOString();
    const roles: UserRole[] = [UserRole.IsMember];
    let newRow: {
      id: string
      tenantId: string
      email: string
      name: string
      role: string
      roles: string[]
    }
    try {
      newRow = await this.prisma.$transaction(async (tx) => {
        if (!tenantExists) {
          // #region agent log
          fetch('http://127.0.0.1:7788/ingest/76c3a999-78a8-4303-8f64-4e64935f7100',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c49aa'},body:JSON.stringify({sessionId:'3c49aa',runId:'pre-fix',hypothesisId:'H9',location:'apps/api/src/auth/auth.service.ts:loginWithGoogle:createTenant',message:'creating tenant for oauth user',data:{tenantId},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          const domain = (emailNorm.split('@')[1] ?? '').trim()
          const name = domain.length > 0 ? domain : 'Demo Tenant'
          await tx.tenant.upsert({
            where: { id: tenantId },
            create: {
              id: tenantId,
              name,
              companyName: name,
              accountStatus: 'active',
              createdAt: now,
              updatedAt: now,
            },
            update: {
              updatedAt: now,
            },
          })
        }
        // #region agent log
        fetch('http://127.0.0.1:7788/ingest/76c3a999-78a8-4303-8f64-4e64935f7100',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c49aa'},body:JSON.stringify({sessionId:'3c49aa',runId:'pre-fix',hypothesisId:'H9',location:'apps/api/src/auth/auth.service.ts:loginWithGoogle:createUser',message:'creating oauth user',data:{tenantId},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
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
          select: { id: true, tenantId: true, email: true, name: true, role: true, roles: true },
        })
        // #region agent log
        fetch('http://127.0.0.1:7788/ingest/76c3a999-78a8-4303-8f64-4e64935f7100',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c49aa'},body:JSON.stringify({sessionId:'3c49aa',runId:'pre-fix',hypothesisId:'H9',location:'apps/api/src/auth/auth.service.ts:loginWithGoogle:membership',message:'upserting project membership',data:{tenantId,userIdPresent:row.id.length>0},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        await upsertProjectMembershipInTx(tx, {
          tenantId,
          userId: row.id,
          roles,
        })
        return row
      })
    } catch (e) {
      // #region agent log
      const code =
        e && typeof e === 'object' && e !== null && 'code' in e
          ? String((e as { code?: unknown }).code)
          : null
      fetch('http://127.0.0.1:7788/ingest/76c3a999-78a8-4303-8f64-4e64935f7100',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c49aa'},body:JSON.stringify({sessionId:'3c49aa',runId:'pre-fix',hypothesisId:'H9',location:'apps/api/src/auth/auth.service.ts:loginWithGoogle:txError',message:'oauth user transaction failed',data:{errorName:e instanceof Error?e.name:'<non-error>',errorMessage:e instanceof Error?e.message:'<non-error>',code},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      throw e
    }

    // #region agent log
    fetch('http://127.0.0.1:7788/ingest/76c3a999-78a8-4303-8f64-4e64935f7100',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c49aa'},body:JSON.stringify({sessionId:'3c49aa',runId:'pre-fix',hypothesisId:'H4',location:'apps/api/src/auth/auth.service.ts:loginWithGoogle:created',message:'loginWithGoogle created user',data:{tenantId:newRow.tenantId,userIdPresent:typeof newRow.id==='string'&&newRow.id.length>0},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
