import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UpsertScriptTemplateDto } from './dto/upsert-script-template.dto';
import { ScriptTemplate, ScriptTab } from './entities/script-template.entity';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScriptsService {
  constructor(private readonly prisma: PrismaService) {}

  private toTemplate = (row: {
    id: string;
    tenantId: string;
    name: string;
    industryTag: string | null;
    tabs: unknown;
    createdBy: string;
    updatedBy: string;
    createdAt: string;
    updatedAt: string;
  }): ScriptTemplate => ({
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    industryTag: row.industryTag,
    tabs: Array.isArray(row.tabs) ? (row.tabs as ScriptTab[]) : [],
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  getTemplates = async (user: JwtPayload): Promise<ScriptTemplate[]> => {
    const rows = await this.prisma.scriptTemplate.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => this.toTemplate(r));
  };

  createTemplate = async (user: JwtPayload, dto: UpsertScriptTemplateDto): Promise<ScriptTemplate> => {
    const now = new Date().toISOString();
    const row = await this.prisma.scriptTemplate.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        industryTag: dto.industryTag?.trim() ? dto.industryTag.trim() : null,
        tabs: dto.tabs as unknown as object,
        createdBy: user.sub,
        updatedBy: user.sub,
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.toTemplate(row);
  };

  updateTemplate = async (
    user: JwtPayload,
    templateId: string,
    dto: UpsertScriptTemplateDto,
  ): Promise<ScriptTemplate> => {
    const existing = await this.prisma.scriptTemplate.findFirst({
      where: { id: templateId, tenantId: user.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('スクリプトテンプレートが見つかりません');
    }

    const now = new Date().toISOString();
    const row = await this.prisma.scriptTemplate.update({
      where: { id: templateId },
      data: {
        name: dto.name,
        industryTag: dto.industryTag?.trim() ? dto.industryTag.trim() : null,
        tabs: dto.tabs as unknown as object,
        updatedBy: user.sub,
        updatedAt: now,
      },
    });
    return this.toTemplate(row);
  };

  deleteTemplate = async (user: JwtPayload, templateId: string): Promise<void> => {
    const existing = await this.prisma.scriptTemplate.findFirst({
      where: { id: templateId, tenantId: user.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('スクリプトテンプレートが見つかりません');
    }

    await this.prisma.scriptTemplate.delete({
      where: { id: templateId },
    });
  };
}
