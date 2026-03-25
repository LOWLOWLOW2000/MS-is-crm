import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isRestrictedMember } from '../common/auth/role-utils';
import { Prisma } from '../generated/prisma/client';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { ImportListCsvDto } from './dto/import-list-csv.dto';
import { ImportListResultDto } from './dto/import-list-result.dto';
import { CallingList } from './entities/calling-list.entity';
import { ListItem } from './entities/list-item.entity';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../common/enums/user-role.enum';

interface ParsedCsvRow {
  companyName: string;
  phone: string;
  address: string;
  targetUrl: string;
  industryTag: string | null;
}

interface UnassignListResult {
  list: CallingList;
  previousAssigneeEmail: string | null;
}

export type ListItemDistributeFilters = {
  addressContains?: string;
  cityContains?: string;
  industryTagContains?: string;
  /** 業種マスタ名の複数（いずれかに industryTag が部分一致） */
  industryNames?: string[];
  /** 未指定時は unstarted（後方互換） */
  callProgress?: 'unstarted' | 'contacted' | 'any';
  statuses?: string[];
  aiTiers?: string[];
};

@Injectable()
export class ListsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 均等配布・プレビュー共通の ListItem where（tenantId / listId 必須） */
  private buildDistributeTargetWhere = (
    user: JwtPayload,
    listId: string,
    filters?: ListItemDistributeFilters,
  ): Prisma.ListItemWhereInput => {
    const where: Prisma.ListItemWhereInput = {
      tenantId: user.tenantId,
      listId,
    };

    const statuses = filters?.statuses?.filter((s) => s.trim().length > 0);
    if (statuses && statuses.length > 0) {
      where.status = { in: statuses };
    } else {
      const progress = filters?.callProgress ?? 'unstarted';
      if (progress === 'unstarted') {
        where.status = 'unstarted';
      } else if (progress === 'contacted') {
        where.status = { in: ['calling', 'done'] };
      }
    }

    const andClauses: Prisma.ListItemWhereInput[] = [];
    const pref = filters?.addressContains?.trim();
    if (pref) {
      andClauses.push({ address: { contains: pref, mode: 'insensitive' } });
    }
    const city = filters?.cityContains?.trim();
    if (city) {
      andClauses.push({ address: { contains: city, mode: 'insensitive' } });
    }

    const industryNames = filters?.industryNames?.map((n) => n.trim()).filter((n) => n.length > 0) ?? [];
    if (industryNames.length > 0) {
      andClauses.push({
        OR: industryNames.map((n) => ({
          industryTag: { contains: n, mode: 'insensitive' as const },
        })),
      });
    } else {
      const tag = filters?.industryTagContains?.trim();
      if (tag) {
        andClauses.push({ industryTag: { contains: tag, mode: 'insensitive' } });
      }
    }

    if (andClauses.length > 0) {
      where.AND = andClauses;
    }

    const tiers = filters?.aiTiers?.filter((t) => t === 'A' || t === 'B' || t === 'C');
    if (tiers && tiers.length > 0) {
      where.aiListTier = { in: tiers };
    }
    return where;
  };

  getIndustryMasters = async (
    user: JwtPayload,
  ): Promise<{ id: string; name: string; groupLabel: string | null }[]> => {
    const rows = await this.prisma.listIndustryMaster.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      select: { id: true, name: true, groupLabel: true },
    });
    return rows.sort(
      (a, b) =>
        (a.groupLabel ?? '').localeCompare(b.groupLabel ?? '', 'ja') || a.name.localeCompare(b.name, 'ja'),
    );
  };

  private parseCsvLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];

      if (char === '"') {
        const isEscapedQuote = inQuotes && line[i + 1] === '"';
        if (isEscapedQuote) {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current.trim());
    return values;
  };

  private normalizeHeader = (value: string): string => {
    return value.toLowerCase().replace(/\s+/g, '').replace(/[_-]/g, '');
  };

  private parseCsvRows = (csvText: string): ParsedCsvRow[] => {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return [];
    }

    const header = this.parseCsvLine(lines[0]).map((value) => this.normalizeHeader(value));

    const getIndex = (aliases: string[], fallback: number): number => {
      const index = header.findIndex((name) => aliases.includes(name));
      return index >= 0 ? index : fallback;
    };

    const companyNameIndex = getIndex(['company', 'companyname', '会社名'], 0);
    const phoneIndex = getIndex(['phone', 'tel', 'phonenumber', '電話番号'], 1);
    const addressIndex = getIndex(['address', '住所'], 2);
    const targetUrlIndex = getIndex(['url', 'website', 'targeturl', '企業url'], 3);
    const industryTagIndex = getIndex(['industry', 'industrytag', '業種'], 4);

    return lines.slice(1).map((line) => {
      const columns = this.parseCsvLine(line);
      return {
        companyName: columns[companyNameIndex] ?? '',
        phone: columns[phoneIndex] ?? '',
        address: columns[addressIndex] ?? '',
        targetUrl: columns[targetUrlIndex] ?? '',
        industryTag: columns[industryTagIndex] ? columns[industryTagIndex] : null,
      };
    });
  };

  private toList = (row: {
    id: string;
    tenantId: string;
    name: string;
    sourceType: string;
    createdBy: string;
    createdAt: string;
    itemCount: number;
    assigneeEmail: string | null;
    assignedBy: string | null;
    assignedAt: string | null;
  }): CallingList => ({
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    sourceType: row.sourceType as CallingList['sourceType'],
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    itemCount: row.itemCount,
    assigneeEmail: row.assigneeEmail,
    assignedBy: row.assignedBy,
    assignedAt: row.assignedAt,
  });

  private toItem = (row: {
    id: string;
    tenantId: string;
    listId: string;
    companyName: string;
    phone: string;
    address: string;
    legalEntityId: string | null;
    targetUrl: string;
    industryTag: string | null;
    assignedToUserId: string | null;
    assignedAt: string | null;
    assignedByUserId: string | null;
    status: string;
    statusUpdatedAt: string | null;
    completedAt: string | null;
    aiListTier: string | null;
    createdAt: string;
  }): ListItem => ({
    id: row.id,
    tenantId: row.tenantId,
    listId: row.listId,
    companyName: row.companyName,
    phone: row.phone,
    address: row.address,
    legalEntityId: row.legalEntityId,
    targetUrl: row.targetUrl,
    industryTag: row.industryTag,
    assignedToUserId: row.assignedToUserId,
    assignedAt: row.assignedAt,
    assignedByUserId: row.assignedByUserId,
    status: row.status,
    statusUpdatedAt: row.statusUpdatedAt,
    completedAt: row.completedAt,
    aiListTier: row.aiListTier,
    createdAt: row.createdAt,
  });

  importCsv = async (user: JwtPayload, dto: ImportListCsvDto): Promise<ImportListResultDto> => {
    const parsedRows = this.parseCsvRows(dto.csvText);
    const nowIso = new Date().toISOString();
    const listName =
      dto.name?.trim() ||
      `CSVリスト-${new Date().toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })}`;

    /**
     * 重要: 「リストをストックする」ため、既存リスト（テナント全体）との重複URLで弾かない。
     * 重複除外は CSV 内のみで行う（同じCSV内でのURL重複はスキップ）。
     */
    const existingUrlSet = new Set<string>();

    const itemsToCreate: { companyName: string; phone: string; address: string; targetUrl: string; industryTag: string | null }[] = [];
    let skippedCount = 0;

    for (const row of parsedRows) {
      if (!row.companyName || !row.phone || !row.address || !row.targetUrl) {
        skippedCount += 1;
        continue;
      }
      if (existingUrlSet.has(row.targetUrl)) {
        skippedCount += 1;
        continue;
      }
      itemsToCreate.push({
        companyName: row.companyName,
        phone: row.phone,
        address: row.address,
        targetUrl: row.targetUrl,
        industryTag: row.industryTag,
      });
      existingUrlSet.add(row.targetUrl);
    }

    const list = await this.prisma.callingList.create({
      data: {
        tenantId: user.tenantId,
        name: listName,
        sourceType: 'csv',
        createdBy: user.sub,
        createdAt: nowIso,
        itemCount: itemsToCreate.length,
        items: {
          create: itemsToCreate.map((row) => ({
            tenantId: user.tenantId,
            companyName: row.companyName,
            phone: row.phone,
            address: row.address,
            targetUrl: row.targetUrl,
            industryTag: row.industryTag,
            status: 'unstarted',
            aiListTier: null,
            createdAt: nowIso,
          })),
        },
      },
    });

    return {
      list: this.toList(list),
      importedCount: itemsToCreate.length,
      skippedCount,
    };
  };

  getLists = async (user: JwtPayload): Promise<CallingList[]> => {
    const rows = await this.prisma.callingList.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toList(r));
  };

  getListItems = async (user: JwtPayload, listId: string): Promise<ListItem[]> => {
    const list = await this.prisma.callingList.findFirst({
      where: { id: listId, tenantId: user.tenantId },
    });
    if (!list) {
      throw new NotFoundException('対象リストが見つかりません');
    }
    const rows = await this.prisma.listItem.findMany({
      where: { tenantId: user.tenantId, listId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toItem(r));
  };

  getAssignedListItems = async (user: JwtPayload, listId: string): Promise<ListItem[]> => {
    const list = await this.prisma.callingList.findFirst({
      where: { id: listId, tenantId: user.tenantId },
    });
    if (!list) {
      throw new NotFoundException('対象リストが見つかりません');
    }
    const email = user.email?.toLowerCase() ?? '';
    if (!list.assigneeEmail || list.assigneeEmail.toLowerCase() !== email) {
      throw new ForbiddenException('配布対象外のリストです');
    }
    const rows = await this.prisma.listItem.findMany({
      where: { tenantId: user.tenantId, listId, assignedToUserId: user.sub },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toItem(r));
  };

  previewDistributeListItemsEven = async (
    user: JwtPayload,
    listId: string,
    filters?: ListItemDistributeFilters,
  ): Promise<{ matchCount: number }> => {
    const list = await this.prisma.callingList.findFirst({
      where: { id: listId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!list) {
      throw new NotFoundException('対象リストが見つかりません');
    }
    const where = this.buildDistributeTargetWhere(user, listId, filters);
    const matchCount = await this.prisma.listItem.count({ where });
    return { matchCount };
  };

  distributeListItemsEven = async (
    user: JwtPayload,
    listId: string,
    assigneeUserIds: string[],
    filters?: ListItemDistributeFilters,
  ): Promise<{ updatedCount: number }> => {
    const list = await this.prisma.callingList.findFirst({
      where: { id: listId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!list) {
      throw new NotFoundException('対象リストが見つかりません');
    }

    const ids = assigneeUserIds.map((x) => x.trim()).filter((x) => x.length > 0);
    if (ids.length === 0) {
      throw new NotFoundException('配布先ユーザーが指定されていません');
    }

    const where = this.buildDistributeTargetWhere(user, listId, filters);
    const targets = await this.prisma.listItem.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (targets.length === 0) {
      return { updatedCount: 0 };
    }

    const nowIso = new Date().toISOString();
    const updates = targets.map((t, i) => ({ id: t.id, assigneeUserId: ids[i % ids.length] }));

    await this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.listItem.update({
          where: { id: u.id },
          data: {
            tenantId: user.tenantId,
            assignedToUserId: u.assigneeUserId,
            assignedAt: nowIso,
            assignedByUserId: user.sub,
            statusUpdatedAt: nowIso,
          },
        }),
      ),
    );

    return { updatedCount: updates.length };
  };

  /**
   * 目標件数（割当件数）に基づく配布
   * - floor: 各メンバーに ideal 配分の小数切り捨て分を割り当て
   * - 残り（端数）は ideal の小数部分が大きいメンバーから順に 1件ずつ割り当て
   * - 最終的な合計割当は必ず matchCount（=対象件数）に一致
   */
  distributeListItemsByTargetCounts = async (
    user: JwtPayload,
    listId: string,
    assigneeUserIds: string[],
    targetCounts: number[],
    filters?: ListItemDistributeFilters,
  ): Promise<{ updatedCount: number }> => {
    const list = await this.prisma.callingList.findFirst({
      where: { id: listId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!list) {
      throw new NotFoundException('対象リストが見つかりません');
    }

    if (assigneeUserIds.length === 0 || targetCounts.length === 0) {
      throw new BadRequestException('配布先ユーザーまたは目標件数が指定されていません');
    }
    if (assigneeUserIds.length !== targetCounts.length) {
      throw new BadRequestException('assigneeUserIds と targetCounts は同じ長さで指定してください');
    }

    const pairs = assigneeUserIds
      .map((userId, i) => ({
        userId: userId.trim(),
        targetCount: targetCounts[i] ?? 0,
        checkOrder: i,
      }))
      .filter((p) => p.userId.length > 0);

    if (pairs.length === 0) {
      throw new BadRequestException('配布先ユーザーが指定されていません');
    }

    const sumTargets = pairs.reduce((acc, p) => acc + (p.targetCount ?? 0), 0);
    if (sumTargets <= 0) {
      throw new BadRequestException('全員目標割当件数（目標件数合計）が 1以上になるよう指定してください');
    }

    const where = this.buildDistributeTargetWhere(user, listId, filters);
    const targets = await this.prisma.listItem.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (targets.length === 0) {
      return { updatedCount: 0 };
    }

    const total = targets.length;
    const nowIso = new Date().toISOString();

    const baseAllocations = pairs.map((p) => {
      const ideal = (total * p.targetCount) / sumTargets;
      const base = Math.floor(ideal);
      const fraction = ideal - base;
      return { userId: p.userId, base, fraction, checkOrder: p.checkOrder };
    });

    const baseSum = baseAllocations.reduce((acc, a) => acc + a.base, 0);
    let remaining = total - baseSum;

    // 本来 remaining は 0 以上になる（整数化の誤差で負になる可能性だけ吸収）
    if (remaining < 0) {
      remaining = 0;
    }

    // 残り（端数）: fraction が大きい順、同点はチェック順
    const sortedByFraction = [...baseAllocations].sort((a, b) => {
      if (b.fraction !== a.fraction) return b.fraction - a.fraction;
      return a.checkOrder - b.checkOrder;
    });

    const extraMembers: string[] = [];
    for (let i = 0; i < sortedByFraction.length && remaining > 0; i += 1) {
      extraMembers.push(sortedByFraction[i].userId);
      remaining -= 1;
    }

    // allocationSequence:
    // 1) floor部分をチェック順に積む
    // 2) 残りは fraction が大きい順に 1件ずつ追加
    const allocationSequence: string[] = [];
    const byCheckOrder = [...baseAllocations].sort((a, b) => a.checkOrder - b.checkOrder);
    for (const a of byCheckOrder) {
      for (let i = 0; i < a.base; i += 1) {
        allocationSequence.push(a.userId);
      }
    }
    for (const u of extraMembers) {
      allocationSequence.push(u);
    }

    if (allocationSequence.length !== total) {
      throw new BadRequestException('配布割当の合計が一致しません（内部エラー）');
    }

    await this.prisma.$transaction(
      targets.map((t, i) =>
        this.prisma.listItem.update({
          where: { id: t.id },
          data: {
            tenantId: user.tenantId,
            assignedToUserId: allocationSequence[i],
            assignedAt: nowIso,
            assignedByUserId: user.sub,
            statusUpdatedAt: nowIso,
          },
        }),
      ),
    );

    return { updatedCount: targets.length };
  };

  recallListItems = async (
    user: JwtPayload,
    listId: string,
    input: { assigneeUserId?: string; mode?: 'all' | 'unstartedOnly' | 'callingOnly' },
  ): Promise<{ updatedCount: number }> => {
    const list = await this.prisma.callingList.findFirst({
      where: { id: listId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!list) {
      throw new NotFoundException('対象リストが見つかりません');
    }

    const mode = input.mode ?? 'unstartedOnly';
    const whereStatus =
      mode === 'all' ? undefined : mode === 'callingOnly' ? 'calling' : 'unstarted';
    const nowIso = new Date().toISOString();

    const result = await this.prisma.listItem.updateMany({
      where: {
        tenantId: user.tenantId,
        listId,
        ...(input.assigneeUserId ? { assignedToUserId: input.assigneeUserId } : {}),
        ...(whereStatus ? { status: whereStatus } : {}),
      },
      data: {
        assignedToUserId: null,
        assignedAt: null,
        assignedByUserId: user.sub,
        statusUpdatedAt: nowIso,
      },
    });

    return { updatedCount: result.count };
  };

  updateListItemStatus = async (
    user: JwtPayload,
    itemId: string,
    status: 'unstarted' | 'calling' | 'done' | 'excluded',
  ): Promise<ListItem> => {
    const nowIso = new Date().toISOString();
    const item = await this.prisma.listItem.findFirst({
      where: { id: itemId, tenantId: user.tenantId },
    });
    if (!item) {
      throw new NotFoundException('対象の企業が見つかりません');
    }

    if (isRestrictedMember(user) && item.assignedToUserId !== user.sub) {
      throw new ForbiddenException('割り当てられていない企業は更新できません');
    }

    const updated = await this.prisma.listItem.update({
      where: { id: itemId },
      data: {
        tenantId: user.tenantId,
        status,
        statusUpdatedAt: nowIso,
        completedAt: status === 'done' ? nowIso : null,
      },
    });
    return this.toItem(updated);
  };

  getListItemById = async (user: JwtPayload, itemId: string): Promise<ListItem> => {
    const item = await this.prisma.listItem.findFirst({
      where: { id: itemId, tenantId: user.tenantId },
    });
    if (!item) {
      throw new NotFoundException('対象の企業が見つかりません');
    }

    if (isRestrictedMember(user) && item.assignedToUserId !== user.sub) {
      throw new ForbiddenException('割り当てられていない企業は参照できません');
    }

    return this.toItem(item);
  };

  getListKpiByAssignee = async (
    user: JwtPayload,
    listId: string,
  ): Promise<{ assigneeUserId: string | null; status: string; count: number }[]> => {
    const list = await this.prisma.callingList.findFirst({
      where: { id: listId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!list) {
      throw new NotFoundException('対象リストが見つかりません');
    }

    const rows = await this.prisma.listItem.groupBy({
      by: ['assignedToUserId', 'status'],
      where: { tenantId: user.tenantId, listId },
      _count: { _all: true },
    });

    return rows.map((r) => ({
      assigneeUserId: r.assignedToUserId ?? null,
      status: r.status,
      count: r._count._all,
    }));
  };

  getAssignedLists = async (user: JwtPayload): Promise<CallingList[]> => {
    const email = user.email?.toLowerCase() ?? '';
    const rows = await this.prisma.callingList.findMany({
      where: { tenantId: user.tenantId, assigneeEmail: { not: null } },
      orderBy: { assignedAt: 'desc' },
    });
    return rows
      .filter((r) => r.assigneeEmail?.toLowerCase() === email)
      .map((r) => this.toList(r));
  };

  assignList = async (user: JwtPayload, listId: string, assigneeEmail: string): Promise<CallingList> => {
    const list = await this.prisma.callingList.findFirst({
      where: { id: listId, tenantId: user.tenantId },
    });
    if (!list) {
      throw new NotFoundException('対象リストが見つかりません');
    }
    const now = new Date().toISOString();
    const updated = await this.prisma.callingList.update({
      where: { id: listId },
      data: {
        assigneeEmail: assigneeEmail.trim().toLowerCase(),
        assignedBy: user.email ?? null,
        assignedAt: now,
      },
    });
    return this.toList(updated);
  };

  unassignList = async (user: JwtPayload, listId: string): Promise<UnassignListResult> => {
    const list = await this.prisma.callingList.findFirst({
      where: { id: listId, tenantId: user.tenantId },
    });
    if (!list) {
      throw new NotFoundException('対象リストが見つかりません');
    }
    const previousAssigneeEmail = list.assigneeEmail;
    const updated = await this.prisma.callingList.update({
      where: { id: listId },
      data: { assigneeEmail: null, assignedBy: null, assignedAt: null },
    });
    return { list: this.toList(updated), previousAssigneeEmail };
  };
}
