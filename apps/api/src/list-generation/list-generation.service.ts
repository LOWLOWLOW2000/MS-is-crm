import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isRestrictedMember } from '../common/auth/role-utils';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMasterDto } from './dto/create-master.dto';
import type { CreateListGenerationRequestDto } from './dto/create-request.dto';

const NOW = (): string => new Date().toISOString();

/**
 * Phase2: リスト生成マスタ（エリア・業種・キーワード）とリクエストのCRUD
 */
@Injectable()
export class ListGenerationService {
  constructor(private readonly prisma: PrismaService) {}

  private assertListGenerationRole = (user: JwtPayload): void => {
    if (isRestrictedMember(user)) {
      throw new ForbiddenException(
        'is_member はリスト生成・マスタにアクセスできません',
      );
    }
  };

  // ---------- エリアマスタ ----------
  listAreas = async (user: JwtPayload) => {
    this.assertListGenerationRole(user);
    return this.prisma.listAreaMaster.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: 'asc' },
    });
  };

  createArea = async (user: JwtPayload, dto: CreateMasterDto) => {
    this.assertListGenerationRole(user);
    const now = NOW();
    const existing = await this.prisma.listAreaMaster.findUnique({
      where: {
        tenantId_name: { tenantId: user.tenantId, name: dto.name.trim() },
      },
    });
    if (existing) {
      throw new ConflictException('同じ名前のエリアが既に存在します');
    }
    return this.prisma.listAreaMaster.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name.trim(),
        isActive: dto.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      },
    });
  };

  updateArea = async (
    user: JwtPayload,
    id: string,
    dto: { name?: string; isActive?: boolean },
  ) => {
    this.assertListGenerationRole(user);
    await this.assertAreaExists(user.tenantId, id);
    const now = NOW();
    return this.prisma.listAreaMaster.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedAt: now,
      },
    });
  };

  deleteArea = async (user: JwtPayload, id: string) => {
    this.assertListGenerationRole(user);
    await this.assertAreaExists(user.tenantId, id);
    await this.prisma.listAreaMaster.delete({ where: { id } });
  };

  private assertAreaExists = async (
    tenantId: string,
    id: string,
  ): Promise<void> => {
    const r = await this.prisma.listAreaMaster.findFirst({
      where: { id, tenantId },
    });
    if (!r) throw new NotFoundException('エリアが見つかりません');
  };

  // ---------- 業種マスタ ----------
  listIndustries = async (user: JwtPayload) => {
    this.assertListGenerationRole(user);
    return this.prisma.listIndustryMaster.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: 'asc' },
    });
  };

  createIndustry = async (user: JwtPayload, dto: CreateMasterDto) => {
    this.assertListGenerationRole(user);
    const now = NOW();
    const existing = await this.prisma.listIndustryMaster.findUnique({
      where: {
        tenantId_name: { tenantId: user.tenantId, name: dto.name.trim() },
      },
    });
    if (existing) {
      throw new ConflictException('同じ名前の業種が既に存在します');
    }
    return this.prisma.listIndustryMaster.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name.trim(),
        isActive: dto.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      },
    });
  };

  updateIndustry = async (
    user: JwtPayload,
    id: string,
    dto: { name?: string; isActive?: boolean },
  ) => {
    this.assertListGenerationRole(user);
    await this.assertIndustryExists(user.tenantId, id);
    const now = NOW();
    return this.prisma.listIndustryMaster.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedAt: now,
      },
    });
  };

  deleteIndustry = async (user: JwtPayload, id: string) => {
    this.assertListGenerationRole(user);
    await this.assertIndustryExists(user.tenantId, id);
    await this.prisma.listIndustryMaster.delete({ where: { id } });
  };

  private assertIndustryExists = async (
    tenantId: string,
    id: string,
  ): Promise<void> => {
    const r = await this.prisma.listIndustryMaster.findFirst({
      where: { id, tenantId },
    });
    if (!r) throw new NotFoundException('業種が見つかりません');
  };

  // ---------- キーワードマスタ ----------
  listKeywords = async (user: JwtPayload) => {
    this.assertListGenerationRole(user);
    return this.prisma.listKeywordMaster.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: 'asc' },
    });
  };

  createKeyword = async (user: JwtPayload, dto: CreateMasterDto) => {
    this.assertListGenerationRole(user);
    const now = NOW();
    const existing = await this.prisma.listKeywordMaster.findUnique({
      where: {
        tenantId_name: { tenantId: user.tenantId, name: dto.name.trim() },
      },
    });
    if (existing) {
      throw new ConflictException('同じ名前のキーワードが既に存在します');
    }
    return this.prisma.listKeywordMaster.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name.trim(),
        isActive: dto.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      },
    });
  };

  updateKeyword = async (
    user: JwtPayload,
    id: string,
    dto: { name?: string; isActive?: boolean },
  ) => {
    this.assertListGenerationRole(user);
    await this.assertKeywordExists(user.tenantId, id);
    const now = NOW();
    return this.prisma.listKeywordMaster.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedAt: now,
      },
    });
  };

  deleteKeyword = async (user: JwtPayload, id: string) => {
    this.assertListGenerationRole(user);
    await this.assertKeywordExists(user.tenantId, id);
    await this.prisma.listKeywordMaster.delete({ where: { id } });
  };

  private assertKeywordExists = async (
    tenantId: string,
    id: string,
  ): Promise<void> => {
    const r = await this.prisma.listKeywordMaster.findFirst({
      where: { id, tenantId },
    });
    if (!r) throw new NotFoundException('キーワードが見つかりません');
  };

  // ---------- リスト生成リクエスト ----------
  createRequest = async (
    user: JwtPayload,
    dto: CreateListGenerationRequestDto,
  ) => {
    this.assertListGenerationRole(user);
    const now = NOW();
    return this.prisma.listGenerationRequest.create({
      data: {
        tenantId: user.tenantId,
        requestedBy: user.sub,
        requestedByEmail: user.email ?? '',
        assignedToEmail: dto.assignedToEmail.trim(),
        input: dto.input as object,
        status: 'queued',
        createdAt: now,
        updatedAt: now,
      },
    });
  };

  listRequests = async (
    user: JwtPayload,
    options?: { status?: string; assignedToEmail?: string },
  ) => {
    this.assertListGenerationRole(user);
    const where: { tenantId: string; status?: string; assignedToEmail?: string } =
      { tenantId: user.tenantId };
    if (options?.status) where.status = options.status;
    if (options?.assignedToEmail) {
      where.assignedToEmail = options.assignedToEmail;
    }
    return this.prisma.listGenerationRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  };

  getRequest = async (user: JwtPayload, id: string) => {
    this.assertListGenerationRole(user);
    const r = await this.prisma.listGenerationRequest.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!r) throw new NotFoundException('リスト生成リクエストが見つかりません');
    return r;
  };

  /**
   * バッチまたは運営が結果を反映する用（status, resultListId, errorMessage）
   */
  updateRequestResult = async (
    user: JwtPayload,
    id: string,
    dto: {
      status?: string;
      resultListId?: string;
      errorMessage?: string;
    },
  ) => {
    this.assertListGenerationRole(user);
    await this.getRequest(user, id);
    const now = NOW();
    return this.prisma.listGenerationRequest.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.resultListId !== undefined && { resultListId: dto.resultListId }),
        ...(dto.errorMessage !== undefined && {
          errorMessage: dto.errorMessage,
        }),
        updatedAt: now,
      },
    });
  };
}
