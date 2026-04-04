import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { hasRole, primaryRole } from '../common/auth/role-utils';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UserRole as UR } from '../common/enums/user-role.enum';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { upsertProjectMembershipInTx } from '../users/project-membership.helper';
import { AuthService } from '../auth/auth.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

const INVITE_EXPIRES_MS = 3 * 24 * 60 * 60 * 1000;
const MOCK_INVITE_EMAIL = '__MOCK_INVITE__'

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(plain: string): string {
    return createHash('sha256').update(plain).digest('hex');
  }

  private createInviteUrlWithMode(plainToken: string, mode: 'email' | 'mock'): string {
    const webBase =
      this.configService.get<string>('WEB_BASE_URL') ?? 'http://localhost:3000'
    const base = webBase.replace(/\/$/, '')
    const qs = `token=${encodeURIComponent(plainToken)}`
    if (mode === 'mock') return `${base}/invite/accept?${qs}&mode=mock`
    return `${base}/invite/accept?${qs}`
  }

  /** 企業管理者のみ：招待を作成しメール送信 */
  async createInvitation(
    jwt: JwtPayload,
    tenantId: string,
    dto: CreateInvitationDto,
  ): Promise<{ id: string; expiresAt: string }> {
    if (jwt.tenantId !== tenantId) {
      throw new ForbiddenException('テナントが一致しません');
    }
    if (!hasRole(jwt, UR.EnterpriseAdmin)) {
      throw new ForbiddenException('企業管理者のみ招待できます');
    }

    const emailNorm = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findFirst({
      where: { tenantId, email: emailNorm },
    });
    if (existingUser) {
      throw new ConflictException('このメールアドレスは既に登録されています');
    }

    const pending = await this.prisma.tenantInvitation.findFirst({
      where: {
        tenantId,
        email: emailNorm,
        consumedAt: null,
        expiresAt: { gt: new Date().toISOString() },
      },
    });
    if (pending) {
      throw new ConflictException('有効な招待が既に存在します');
    }

    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(plainToken);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + INVITE_EXPIRES_MS).toISOString();

    const row = await this.prisma.tenantInvitation.create({
      data: {
        tenantId,
        email: emailNorm,
        tokenHash,
        invitedRoles: dto.roles,
        invitedByUserId: jwt.sub,
        expiresAt,
        createdAt: now,
      },
    });

    const webBase =
      this.configService.get<string>('WEB_BASE_URL') ?? 'http://localhost:3000';
    const inviteUrl = this.createInviteUrlWithMode(plainToken, 'email');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const label = tenant?.companyName ?? tenant?.name ?? '企業';

    await this.emailService.sendInvitationEmail({
      to: emailNorm,
      inviteUrl,
      tenantLabel: label,
    });

    return { id: row.id, expiresAt };
  }

  /** 企業管理者：テナントの招待一覧（トークンは返さない） */
  listInvitations = async (
    jwt: JwtPayload,
    tenantId: string,
  ): Promise<
    {
      id: string;
      email: string;
      roles: UR[];
      expiresAt: string;
      consumedAt: string | null;
      createdAt: string;
      status: 'pending' | 'expired' | 'used';
    }[]
  > => {
    if (jwt.tenantId !== tenantId) {
      throw new ForbiddenException('テナントが一致しません');
    }
    if (!hasRole(jwt, UR.EnterpriseAdmin)) {
      throw new ForbiddenException('企業管理者のみ一覧を取得できます');
    }

    const rows = await this.prisma.tenantInvitation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        email: true,
        invitedRoles: true,
        expiresAt: true,
        consumedAt: true,
        createdAt: true,
      },
    });

    const now = new Date().toISOString();

    const roleValues = new Set<string>(Object.values(UR));

    return rows.map((r) => {
      const raw = r.invitedRoles;
      const roles = Array.isArray(raw)
        ? (raw.filter((x): x is UR => typeof x === 'string' && roleValues.has(x)) as UR[])
        : [];
      let status: 'pending' | 'expired' | 'used' = 'pending';
      if (r.consumedAt) {
        status = 'used';
      } else if (r.expiresAt < now) {
        status = 'expired';
      }
      return {
        id: r.id,
        email: r.email,
        roles,
        expiresAt: r.expiresAt,
        consumedAt: r.consumedAt,
        createdAt: r.createdAt,
        status,
      };
    });
  };

  /**
   * 未使用招待のみ削除（使用済みは対象外）。トークンは以後無効。
   */
  revokeInvitations = async (
    jwt: JwtPayload,
    tenantId: string,
    invitationIds: string[],
  ): Promise<{ revoked: number }> => {
    if (jwt.tenantId !== tenantId) {
      throw new ForbiddenException('テナントが一致しません');
    }
    if (!hasRole(jwt, UR.EnterpriseAdmin)) {
      throw new ForbiddenException('企業管理者のみ招待を取り消せます');
    }
    const unique = [...new Set(invitationIds)].filter((id) => id.length > 0);
    if (unique.length === 0) {
      throw new BadRequestException('取り消し対象のIDがありません');
    }
    const result = await this.prisma.tenantInvitation.deleteMany({
      where: {
        tenantId,
        id: { in: unique },
        consumedAt: null,
      },
    });
    return { revoked: result.count };
  };

  async validateToken(plainToken: string): Promise<{
    tenantId: string;
    tenantName: string;
    email: string;
    roles: UR[];
    expiresAt: string;
  }> {
    if (!plainToken || plainToken.length < 32) {
      throw new BadRequestException('トークンが不正です');
    }
    const tokenHash = this.hashToken(plainToken);
    const inv = await this.prisma.tenantInvitation.findUnique({
      where: { tokenHash },
      include: { tenant: true },
    });

    if (!inv) {
      throw new NotFoundException('招待が見つかりません');
    }
    if (inv.consumedAt) {
      throw new BadRequestException('この招待は既に使用済みです');
    }
    const now = new Date().toISOString();
    if (inv.expiresAt < now) {
      throw new BadRequestException('招待の有効期限が切れています');
    }

    const roles = inv.invitedRoles as UR[];
    return {
      tenantId: inv.tenantId,
      tenantName: inv.tenant.companyName ?? inv.tenant.name,
      email: inv.email,
      roles,
      expiresAt: inv.expiresAt,
    };
  }

  /** 招待を承諾してユーザーを作成しログイン用トークンを返す */
  async acceptInvitation(params: {
    plainToken: string;
    password?: string;
    name?: string;
  }): Promise<Awaited<ReturnType<AuthService['issueTokensForUser']>>> {
    const tokenHash = this.hashToken(params.plainToken);
    const inv = await this.prisma.tenantInvitation.findUnique({
      where: { tokenHash },
    });

    if (!inv) {
      throw new NotFoundException('招待が見つかりません');
    }
    if (inv.consumedAt) {
      throw new BadRequestException('この招待は既に使用済みです');
    }
    const now = new Date().toISOString();
    if (inv.expiresAt < now) {
      throw new BadRequestException('招待の有効期限が切れています');
    }

    const existing = await this.prisma.user.findFirst({
      where: { tenantId: inv.tenantId, email: inv.email },
    });
    if (existing) {
      throw new ConflictException('このメールアドレスは既に登録されています');
    }

    const rolesRaw = inv.invitedRoles as UR[];
    if (!Array.isArray(rolesRaw) || rolesRaw.length === 0) {
      throw new BadRequestException('招待のロールが不正です');
    }

    const passwordHash =
      params.password && params.password.length > 0
        ? await bcrypt.hash(params.password, 10)
        : null;
    if (!passwordHash) {
      throw new BadRequestException(
        'パスワードを設定するか、OAuth で参加する場合は別フローでログインしてください',
      );
    }

    const pr = primaryRole(rolesRaw);
    const displayName = params.name?.trim() || inv.email.split('@')[0];

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          tenantId: inv.tenantId,
          email: inv.email,
          name: displayName,
          passwordHash,
          role: pr,
          roles: rolesRaw,
          createdAt: now,
          updatedAt: now,
        },
      });

      await upsertProjectMembershipInTx(tx, {
        tenantId: inv.tenantId,
        userId: u.id,
        roles: rolesRaw,
      });

      await tx.tenantInvitation.update({
        where: { id: inv.id },
        data: { consumedAt: now },
      });

      return u;
    });

    return this.authService.issueTokensForUser(user.id);
  }

  /** 仮招待トークン発行（メールDNS不要のため、1回発行したURLは何人でも使える） */
  async issueMockInvitation(
    jwt: JwtPayload,
    tenantId: string,
    roles: UR[],
  ): Promise<{ inviteUrl: string; expiresAt: string }> {
    if (jwt.tenantId !== tenantId) {
      throw new ForbiddenException('テナントが一致しません');
    }
    if (!hasRole(jwt, UR.EnterpriseAdmin)) {
      throw new ForbiddenException('企業管理者のみ招待URLを発行できます');
    }

    const roleValues = new Set<string>(Object.values(UR))
    const rolesValidated = roles.filter((r) => roleValues.has(r))
    if (rolesValidated.length === 0) {
      throw new BadRequestException('招待ロールが不正です');
    }

    const now = new Date().toISOString()

    // 既存の「仮URL」は無効化（consumedAt を入れることで validate/mock-accept 側で弾く）
    await this.prisma.tenantInvitation.updateMany({
      where: {
        tenantId,
        email: MOCK_INVITE_EMAIL,
        consumedAt: null,
      },
      data: { consumedAt: now },
    })

    const plainToken = randomBytes(32).toString('hex')
    const tokenHash = this.hashToken(plainToken)
    const expiresAt = new Date(Date.now() + INVITE_EXPIRES_MS).toISOString()

    await this.prisma.tenantInvitation.create({
      data: {
        tenantId,
        email: MOCK_INVITE_EMAIL,
        tokenHash,
        invitedRoles: rolesValidated,
        invitedByUserId: jwt.sub,
        expiresAt,
        createdAt: now,
      },
    })

    return {
      inviteUrl: this.createInviteUrlWithMode(plainToken, 'mock'),
      expiresAt,
    }
  }

  /** 仮招待トークンの検証（参加登録は email input 前提） */
  async validateMockToken(
    plainToken: string,
  ): Promise<{
    tenantId: string;
    tenantName: string;
    roles: UR[];
    expiresAt: string;
  }> {
    if (!plainToken || plainToken.length < 32) {
      throw new BadRequestException('トークンが不正です');
    }
    const tokenHash = this.hashToken(plainToken)
    const inv = await this.prisma.tenantInvitation.findUnique({
      where: { tokenHash },
      include: { tenant: true },
    })
    if (!inv || inv.email !== MOCK_INVITE_EMAIL) {
      throw new NotFoundException('招待が見つかりません');
    }
    if (inv.consumedAt) {
      throw new BadRequestException('この招待は既に無効です');
    }
    const now = new Date().toISOString()
    if (inv.expiresAt < now) {
      throw new BadRequestException('招待の有効期限が切れています');
    }
    const roles = inv.invitedRoles as UR[]
    return {
      tenantId: inv.tenantId,
      tenantName: inv.tenant.companyName ?? inv.tenant.name,
      roles,
      expiresAt: inv.expiresAt,
    }
  }

  /** 仮招待：同一 URL を何人でも使ってユーザー作成（ただし URL 無効化後は不可） */
  async acceptMockInvitation(params: {
    plainToken: string;
    email: string;
    password?: string;
    name?: string;
  }): Promise<Awaited<ReturnType<AuthService['issueTokensForUser']>>> {
    const tokenHash = this.hashToken(params.plainToken)
    const inv = await this.prisma.tenantInvitation.findUnique({
      where: { tokenHash },
      include: { tenant: true },
    })

    if (!inv || inv.email !== MOCK_INVITE_EMAIL) {
      throw new NotFoundException('招待が見つかりません');
    }
    if (inv.consumedAt) {
      throw new BadRequestException('この招待は既に無効です');
    }

    const now = new Date().toISOString()
    if (inv.expiresAt < now) {
      throw new BadRequestException('招待の有効期限が切れています');
    }

    const emailNorm = params.email.trim().toLowerCase()
    const existing = await this.prisma.user.findFirst({
      where: { tenantId: inv.tenantId, email: emailNorm },
    })
    if (existing) {
      throw new ConflictException('このメールアドレスは既に登録されています');
    }

    const rolesRaw = inv.invitedRoles as UR[]
    if (!Array.isArray(rolesRaw) || rolesRaw.length === 0) {
      throw new BadRequestException('招待のロールが不正です');
    }

    const passwordHash =
      params.password && params.password.length > 0
        ? await bcrypt.hash(params.password, 10)
        : null
    if (!passwordHash) {
      throw new BadRequestException(
        'パスワードを設定するか、OAuth で参加する場合は別フローでログインしてください',
      );
    }

    const pr = primaryRole(rolesRaw)
    const displayName = params.name?.trim() || emailNorm.split('@')[0]

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          tenantId: inv.tenantId,
          email: emailNorm,
          name: displayName,
          passwordHash,
          role: pr,
          roles: rolesRaw,
          createdAt: now,
          updatedAt: now,
        },
      })

      await upsertProjectMembershipInTx(tx, {
        tenantId: inv.tenantId,
        userId: u.id,
        roles: rolesRaw,
      })

      return u
    })

    return this.authService.issueTokensForUser(user.id)
  }
}
