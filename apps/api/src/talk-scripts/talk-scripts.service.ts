import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { hasAnyRole } from '../common/auth/role-utils';
import { UserRole } from '../common/enums/user-role.enum';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTalkScriptVersionDto } from './dto/create-talk-script-version.dto';
import type { UpdateTalkScriptVersionDto } from './dto/update-talk-script-version.dto';

const DIRECTOR_ROLES: UserRole[] = [
  UserRole.Director,
  UserRole.EnterpriseAdmin,
  UserRole.IsAdmin,
  UserRole.Developer,
];

@Injectable()
export class TalkScriptsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertDirector = (user: JwtPayload): void => {
    if (!hasAnyRole(user, DIRECTOR_ROLES)) {
      throw new ForbiddenException('トークスクリプトの編集はディレクターまたは管理者のみ可能です');
    }
  };

  private async getProjectForTenant(tenantId: string): Promise<{ id: string }> {
    const project = await this.prisma.project.findUnique({
      where: { tenantId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('プロジェクトが見つかりません');
    }
    return project;
  }

  private validateContent(type: 'linear' | 'branching', content: Record<string, unknown>): void {
    if (type === 'linear') {
      const blocks = content.blocks;
      if (!Array.isArray(blocks) || blocks.length === 0) {
        throw new BadRequestException('linear 型は blocks 配列が必須です');
      }
      return;
    }
    const nodes = content.nodes;
    const start = content.startNodeId;
    if (!Array.isArray(nodes) || typeof start !== 'string' || !start.length) {
      throw new BadRequestException('branching 型は nodes と startNodeId が必須です');
    }
  }

  private async ensureTemplate(
    tenantId: string,
    projectId: string,
    type: 'linear' | 'branching',
  ): Promise<{ id: string }> {
    const now = new Date().toISOString();
    return this.prisma.talkScriptTemplate.upsert({
      where: { projectId_type: { projectId, type } },
      create: {
        tenantId,
        projectId,
        type,
        createdAt: now,
        updatedAt: now,
      },
      update: { updatedAt: now },
      select: { id: true },
    });
  }

  async listPublished(
    user: JwtPayload,
    type: 'linear' | 'branching',
  ): Promise<
    { id: string; label: string; publishedAt: string | null; updatedAt: string }[]
  > {
    const project = await this.getProjectForTenant(user.tenantId);
    const template = await this.prisma.talkScriptTemplate.findUnique({
      where: { projectId_type: { projectId: project.id, type } },
      select: { id: true },
    });
    if (!template) {
      return [];
    }
    const rows = await this.prisma.talkScriptVersion.findMany({
      where: { templateId: template.id, status: 'published' },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        label: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
    return rows;
  }

  async getPublishedVersion(user: JwtPayload, versionId: string): Promise<{
    id: string;
    type: string;
    label: string;
    content: unknown;
  }> {
    const project = await this.getProjectForTenant(user.tenantId);
    const row = await this.prisma.talkScriptVersion.findFirst({
      where: {
        id: versionId,
        status: 'published',
        template: { projectId: project.id, tenantId: user.tenantId },
      },
      include: { template: { select: { type: true } } },
    });
    if (!row) {
      throw new NotFoundException('スクリプトが見つかりません');
    }
    return {
      id: row.id,
      type: row.template.type,
      label: row.label,
      content: row.content,
    };
  }

  async listDrafts(
    user: JwtPayload,
    type: 'linear' | 'branching',
  ): Promise<{ id: string; label: string; status: string; updatedAt: string }[]> {
    this.assertDirector(user);
    const project = await this.getProjectForTenant(user.tenantId);
    const template = await this.ensureTemplate(user.tenantId, project.id, type);
    return this.prisma.talkScriptVersion.findMany({
      where: { templateId: template.id, status: 'draft' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, label: true, status: true, updatedAt: true },
    });
  }

  async getVersionForEdit(user: JwtPayload, versionId: string): Promise<{
    id: string;
    type: string;
    label: string;
    status: string;
    content: unknown;
  }> {
    this.assertDirector(user);
    const project = await this.getProjectForTenant(user.tenantId);
    const row = await this.prisma.talkScriptVersion.findFirst({
      where: {
        id: versionId,
        template: { projectId: project.id, tenantId: user.tenantId },
      },
      include: { template: { select: { type: true } } },
    });
    if (!row) {
      throw new NotFoundException('バージョンが見つかりません');
    }
    return {
      id: row.id,
      type: row.template.type,
      label: row.label,
      status: row.status,
      content: row.content,
    };
  }

  async createVersion(user: JwtPayload, dto: CreateTalkScriptVersionDto): Promise<{ id: string }> {
    this.assertDirector(user);
    this.validateContent(dto.type, dto.content);
    const project = await this.getProjectForTenant(user.tenantId);
    const template = await this.ensureTemplate(user.tenantId, project.id, dto.type);
    const now = new Date().toISOString();
    const row = await this.prisma.talkScriptVersion.create({
      data: {
        templateId: template.id,
        label: dto.label.trim(),
        status: 'draft',
        content: dto.content as Prisma.InputJsonValue,
        createdByUserId: user.sub,
        createdAt: now,
        updatedAt: now,
      },
      select: { id: true },
    });
    return row;
  }

  async updateVersion(
    user: JwtPayload,
    versionId: string,
    dto: UpdateTalkScriptVersionDto,
  ): Promise<void> {
    this.assertDirector(user);
    const project = await this.getProjectForTenant(user.tenantId);
    const row = await this.prisma.talkScriptVersion.findFirst({
      where: {
        id: versionId,
        template: { projectId: project.id, tenantId: user.tenantId },
      },
      include: { template: { select: { type: true } } },
    });
    if (!row) {
      throw new NotFoundException('バージョンが見つかりません');
    }
    if (row.status !== 'draft') {
      throw new BadRequestException('下書きのみ更新できます');
    }
    const nextContent = dto.content ?? (row.content as Record<string, unknown>);
    this.validateContent(row.template.type as 'linear' | 'branching', nextContent);
    const now = new Date().toISOString();
    await this.prisma.talkScriptVersion.update({
      where: { id: versionId },
      data: {
        ...(dto.label != null ? { label: dto.label.trim() } : {}),
        ...(dto.content != null ? { content: dto.content as Prisma.InputJsonValue } : {}),
        updatedAt: now,
      },
    });
  }

  async publishVersion(user: JwtPayload, versionId: string): Promise<void> {
    this.assertDirector(user);
    const project = await this.getProjectForTenant(user.tenantId);
    const row = await this.prisma.talkScriptVersion.findFirst({
      where: {
        id: versionId,
        status: 'draft',
        template: { projectId: project.id, tenantId: user.tenantId },
      },
    });
    if (!row) {
      throw new NotFoundException('下書きバージョンが見つかりません');
    }
    const now = new Date().toISOString();
    await this.prisma.talkScriptVersion.update({
      where: { id: versionId },
      data: {
        status: 'published',
        publishedAt: now,
        updatedAt: now,
      },
    });
  }
}
