import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { ImportListCsvDto } from './dto/import-list-csv.dto';
import { ImportListResultDto } from './dto/import-list-result.dto';
import { CallingList } from './entities/calling-list.entity';
import { ListItem } from './entities/list-item.entity';

interface ParsedCsvRow {
  companyName: string;
  phone: string;
  address: string;
  targetUrl: string;
  industryTag: string | null;
}

@Injectable()
export class ListsService {
  private readonly lists: CallingList[] = [];
  private readonly items: ListItem[] = [];

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

  importCsv = (user: JwtPayload, dto: ImportListCsvDto): ImportListResultDto => {
    const parsedRows = this.parseCsvRows(dto.csvText);
    const nowIso = new Date().toISOString();

    const list: CallingList = {
      id: `list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId: user.tenantId,
      name: dto.name?.trim() || `CSVリスト-${new Date().toLocaleDateString('ja-JP')}`,
      sourceType: 'csv',
      createdBy: user.sub,
      createdAt: nowIso,
      itemCount: 0,
      assigneeEmail: null,
      assignedAt: null,
    };

    const existingUrls = new Set(
      this.items
        .filter((item) => item.tenantId === user.tenantId)
        .map((item) => item.targetUrl)
        .filter((url) => url.length > 0),
    );

    let importedCount = 0;
    let skippedCount = 0;

    parsedRows.forEach((row) => {
      if (!row.companyName || !row.phone || !row.address || !row.targetUrl) {
        skippedCount += 1;
        return;
      }

      if (existingUrls.has(row.targetUrl)) {
        skippedCount += 1;
        return;
      }

      const item: ListItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tenantId: user.tenantId,
        listId: list.id,
        companyName: row.companyName,
        phone: row.phone,
        address: row.address,
        targetUrl: row.targetUrl,
        industryTag: row.industryTag,
        createdAt: nowIso,
      };

      this.items.push(item);
      existingUrls.add(row.targetUrl);
      importedCount += 1;
    });

    list.itemCount = importedCount;
    this.lists.push(list);

    return {
      list,
      importedCount,
      skippedCount,
    };
  };

  getLists = (user: JwtPayload): CallingList[] => {
    return this.lists
      .filter((list) => list.tenantId === user.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  };

  getListItems = (user: JwtPayload, listId: string): ListItem[] => {
    const list = this.lists.find((candidate) => candidate.id === listId && candidate.tenantId === user.tenantId);

    if (!list) {
      throw new NotFoundException('対象リストが見つかりません');
    }

    return this.items
      .filter((item) => item.tenantId === user.tenantId && item.listId === listId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  };

  assignList = (user: JwtPayload, listId: string, assigneeEmail: string): CallingList => {
    const list = this.lists.find((candidate) => candidate.id === listId && candidate.tenantId === user.tenantId);

    if (!list) {
      throw new NotFoundException('対象リストが見つかりません');
    }

    list.assigneeEmail = assigneeEmail;
    list.assignedAt = new Date().toISOString();
    return list;
  };
}
