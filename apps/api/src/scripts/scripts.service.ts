import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UpsertScriptTemplateDto } from './dto/upsert-script-template.dto';
import { ScriptTemplate } from './entities/script-template.entity';

@Injectable()
export class ScriptsService {
  private readonly templates: ScriptTemplate[] = [];

  getTemplates = (user: JwtPayload): ScriptTemplate[] => {
    return this.templates
      .filter((template) => template.tenantId === user.tenantId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  };

  createTemplate = (user: JwtPayload, dto: UpsertScriptTemplateDto): ScriptTemplate => {
    const nowIso = new Date().toISOString();

    const template: ScriptTemplate = {
      id: `script-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId: user.tenantId,
      name: dto.name,
      industryTag: dto.industryTag?.trim() ? dto.industryTag.trim() : null,
      tabs: dto.tabs,
      createdBy: user.sub,
      updatedBy: user.sub,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.templates.push(template);
    return template;
  };

  updateTemplate = (
    user: JwtPayload,
    templateId: string,
    dto: UpsertScriptTemplateDto,
  ): ScriptTemplate => {
    const template = this.templates.find(
      (candidate) => candidate.id === templateId && candidate.tenantId === user.tenantId,
    );

    if (!template) {
      throw new NotFoundException('スクリプトテンプレートが見つかりません');
    }

    template.name = dto.name;
    template.industryTag = dto.industryTag?.trim() ? dto.industryTag.trim() : null;
    template.tabs = dto.tabs;
    template.updatedBy = user.sub;
    template.updatedAt = new Date().toISOString();

    return template;
  };

  deleteTemplate = (user: JwtPayload, templateId: string): void => {
    const index = this.templates.findIndex(
      (candidate) => candidate.id === templateId && candidate.tenantId === user.tenantId,
    );

    if (index < 0) {
      throw new NotFoundException('スクリプトテンプレートが見つかりません');
    }

    this.templates.splice(index, 1);
  };
}
