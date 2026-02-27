import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { ImportListCsvDto } from './dto/import-list-csv.dto';
import { ImportListResultDto } from './dto/import-list-result.dto';
import { CallingList } from './entities/calling-list.entity';
import { ListItem } from './entities/list-item.entity';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class ListsService {
  constructor(private readonly prisma: PrismaService) {}

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
    targetUrl: string;
    industryTag: string | null;
    createdAt: string;
  }): ListItem => ({
    id: row.id,
    tenantId: row.tenantId,
    listId: row.listId,
    companyName: row.companyName,
    phone: row.phone,
    address: row.address,
    targetUrl: row.targetUrl,
    industryTag: row.industryTag,
    createdAt: row.createdAt,
  });

  importCsv = async (user: JwtPayload, dto: ImportListCsvDto): Promise<ImportListResultDto> => {
    const parsedRows = this.parseCsvRows(dto.csvText);
    const nowIso = new Date().toISOString();
    const listName = dto.name?.trim() || `CSVリスト-${new Date().toLocaleDateString('ja-JP')}`;

    const existingUrls = await this.prisma.listItem.findMany({
      where: { tenantId: user.tenantId },
      select: { targetUrl: true },
    });
    const existingUrlSet = new Set(existingUrls.map((r) => r.targetUrl).filter((u) => u.length > 0));

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
      where: { tenantId: user.tenantId, listId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toItem(r));
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
