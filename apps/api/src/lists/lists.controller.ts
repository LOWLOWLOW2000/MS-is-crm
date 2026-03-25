import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { hasAnyRole, isRestrictedMember } from '../common/auth/role-utils';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { ImportListCsvDto } from './dto/import-list-csv.dto';
import { ImportListResultDto } from './dto/import-list-result.dto';
import { AssignListDto } from './dto/assign-list.dto';
import { DistributeListItemsDto } from './dto/distribute-list-items.dto';
import { DistributeListItemsTargetDto } from './dto/distribute-list-items-target.dto';
import { ListIndustryMasterRowDto } from './dto/list-industry-master-row.dto';
import type { ListItemDistributeFilters } from './lists.service';
import { RecallListItemsDto } from './dto/recall-list-items.dto';
import { UpdateListItemStatusDto } from './dto/update-list-item-status.dto';
import { CallingList } from './entities/calling-list.entity';
import { ListItem } from './entities/list-item.entity';
import { ListsService } from './lists.service';
import { DISTRIBUTE_LIST_ITEM_STATUSES } from './dto/distribute-filters.dto';

interface JwtRequest extends Request {
  user: JwtPayload;
}

@Controller('lists')
@UseGuards(JwtAuthGuard)
export class ListsController {
  constructor(
    private readonly listsService: ListsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  private assertListManageRole = (user: JwtPayload): void => {
    if (isRestrictedMember(user)) {
      throw new ForbiddenException('is_member はリスト管理にアクセスできません');
    }
  };

  private assertDirectorRole = (user: JwtPayload): void => {
    const ok = hasAnyRole(user, [
      UserRole.Developer,
      UserRole.EnterpriseAdmin,
      UserRole.IsAdmin,
      UserRole.Director,
    ]);
    if (!ok) {
      throw new ForbiddenException('ディレクター権限が必要です');
    }
  };

  private parseCallProgressQuery = (raw?: string): ListItemDistributeFilters['callProgress'] => {
    if (raw === undefined || raw === '') {
      return undefined;
    }
    if (raw === 'unstarted' || raw === 'contacted' || raw === 'any') {
      return raw;
    }
    throw new BadRequestException('callProgress は unstarted / contacted / any のみ指定できます');
  };

  private parseAiTiersQuery = (raw?: string | string[]): string[] | undefined => {
    if (raw === undefined) {
      return undefined;
    }
    const arr = Array.isArray(raw) ? raw : [raw];
    const ok = arr.filter((x): x is 'A' | 'B' | 'C' => x === 'A' || x === 'B' || x === 'C');
    return ok.length > 0 ? ok : undefined;
  };

  private parseStatusesQuery = (raw?: string | string[]): string[] | undefined => {
    if (raw === undefined) {
      return undefined;
    }
    const arr = Array.isArray(raw) ? raw : [raw];
    const trimmed = arr.map((x) => x.trim()).filter((x) => x.length > 0);
    const ok = trimmed.filter((x) =>
      (DISTRIBUTE_LIST_ITEM_STATUSES as readonly string[]).includes(x),
    );
    return ok.length > 0 ? ok : undefined;
  };

  /** 業種マスタ名の複数（クエリは industryNames を繰り返し） */
  private parseIndustryNamesQuery = (raw?: string | string[]): string[] | undefined => {
    if (raw === undefined) {
      return undefined;
    }
    const arr = Array.isArray(raw) ? raw : [raw];
    const trimmed = arr.map((x) => x.trim()).filter((x) => x.length > 0);
    return trimmed.length > 0 ? trimmed : undefined;
  };

  @Post('import-csv')
  async importCsv(@Req() req: JwtRequest, @Body() dto: ImportListCsvDto): Promise<ImportListResultDto> {
    try {
      this.assertListManageRole(req.user);
      const result = await this.listsService.importCsv(req.user, dto);
      this.notificationsGateway.emitListDistributed({
        tenantId: req.user.tenantId,
        listId: result.list.id,
        listName: result.list.name,
        itemCount: result.importedCount,
        distributedAt: new Date().toISOString(),
      });
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[lists.importCsv]', error);
      throw new InternalServerErrorException('CSVインポートに失敗しました');
    }
  }

  @Get('items/:itemId')
  async getListItemById(@Req() req: JwtRequest, @Param('itemId') itemId: string): Promise<ListItem> {
    try {
      return await this.listsService.getListItemById(req.user, itemId);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error
      }
      throw new InternalServerErrorException('リスト明細の取得に失敗しました')
    }
  }

  @Get()
  async getLists(@Req() req: JwtRequest): Promise<CallingList[]> {
    try {
      this.assertListManageRole(req.user);
      return await this.listsService.getLists(req.user);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('リスト一覧の取得に失敗しました');
    }
  }

  @Get('assigned/me')
  async getMyAssignedLists(@Req() req: JwtRequest): Promise<CallingList[]> {
    try {
      return await this.listsService.getAssignedLists(req.user);
    } catch {
      throw new InternalServerErrorException('配布リストの取得に失敗しました');
    }
  }

  @Get('masters/industries')
  async getIndustryMasters(@Req() req: JwtRequest): Promise<ListIndustryMasterRowDto[]> {
    try {
      this.assertDirectorRole(req.user);
      return await this.listsService.getIndustryMasters(req.user);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('業種マスタの取得に失敗しました');
    }
  }

  /** 条件付き均等配布の対象件数プレビュー（:listId/items より先に登録） */
  @Get(':listId/items/distribute-even/preview')
  async previewDistributeEven(
    @Req() req: JwtRequest,
    @Param('listId') listId: string,
    @Query('addressContains') addressContains?: string,
    @Query('cityContains') cityContains?: string,
    @Query('industryTagContains') industryTagContains?: string,
    @Query('industryNames') industryNamesRaw?: string | string[],
    @Query('callProgress') callProgressRaw?: string,
    @Query('statuses') statusesRaw?: string | string[],
    @Query('aiTiers') aiTiersRaw?: string | string[],
  ): Promise<{ matchCount: number }> {
    try {
      this.assertDirectorRole(req.user);
      const callProgress = this.parseCallProgressQuery(callProgressRaw);
      const statuses = this.parseStatusesQuery(statusesRaw);
      const industryNames = this.parseIndustryNamesQuery(industryNamesRaw);
      const aiTiers = this.parseAiTiersQuery(aiTiersRaw);
      return await this.listsService.previewDistributeListItemsEven(req.user, listId, {
        addressContains,
        cityContains,
        industryTagContains,
        industryNames,
        callProgress,
        statuses,
        aiTiers,
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('配布対象件数の取得に失敗しました');
    }
  }

  @Get(':listId/items')
  async getListItems(@Req() req: JwtRequest, @Param('listId') listId: string): Promise<ListItem[]> {
    try {
      if (isRestrictedMember(req.user)) {
        return await this.listsService.getAssignedListItems(req.user, listId);
      }
      return await this.listsService.getListItems(req.user, listId);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('リスト明細の取得に失敗しました');
    }
  }

  @Post(':listId/items/distribute-even')
  async distributeEven(
    @Req() req: JwtRequest,
    @Param('listId') listId: string,
    @Body() dto: DistributeListItemsDto,
  ): Promise<{ updatedCount: number }> {
    try {
      this.assertDirectorRole(req.user);
      return await this.listsService.distributeListItemsEven(req.user, listId, dto.assigneeUserIds, {
        addressContains: dto.addressContains,
        cityContains: dto.cityContains,
        industryTagContains: dto.industryTagContains,
        industryNames: dto.industryNames,
        callProgress: dto.callProgress,
        statuses: dto.statuses,
        aiTiers: dto.aiTiers,
      });
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('配布に失敗しました');
    }
  }

  /**
   * 目標件数（割当件数）に基づく配布（:listId/items/distribute-target）
   * - assigneeUserIds と targetCounts は同じ順序で対応
   */
  @Post(':listId/items/distribute-target')
  async distributeTarget(
    @Req() req: JwtRequest,
    @Param('listId') listId: string,
    @Body() dto: DistributeListItemsTargetDto,
  ): Promise<{ updatedCount: number }> {
    try {
      this.assertDirectorRole(req.user);
      return await this.listsService.distributeListItemsByTargetCounts(
        req.user,
        listId,
        dto.assigneeUserIds,
        dto.targetCounts,
        {
          addressContains: dto.addressContains,
          cityContains: dto.cityContains,
          industryTagContains: dto.industryTagContains,
          industryNames: dto.industryNames,
          callProgress: dto.callProgress,
          statuses: dto.statuses,
          aiTiers: dto.aiTiers,
        },
      );
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('目標件数配布に失敗しました');
    }
  }

  @Post(':listId/items/recall')
  async recall(
    @Req() req: JwtRequest,
    @Param('listId') listId: string,
    @Body() dto: RecallListItemsDto,
  ): Promise<{ updatedCount: number }> {
    try {
      this.assertDirectorRole(req.user);
      return await this.listsService.recallListItems(req.user, listId, {
        assigneeUserId: dto.assigneeUserId,
        mode: dto.mode,
      });
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('引き上げに失敗しました');
    }
  }

  @Post('items/:itemId/status')
  async updateItemStatus(
    @Req() req: JwtRequest,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateListItemStatusDto,
  ): Promise<ListItem> {
    try {
      return await this.listsService.updateListItemStatus(req.user, itemId, dto.status);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('ステータス更新に失敗しました');
    }
  }

  @Get(':listId/kpi/by-assignee')
  async kpiByAssignee(
    @Req() req: JwtRequest,
    @Param('listId') listId: string,
  ): Promise<{ assigneeUserId: string | null; status: string; count: number }[]> {
    try {
      this.assertDirectorRole(req.user);
      return await this.listsService.getListKpiByAssignee(req.user, listId);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('KPIの取得に失敗しました');
    }
  }

  @Post(':listId/assign')
  async assignList(
    @Req() req: JwtRequest,
    @Param('listId') listId: string,
    @Body() dto: AssignListDto,
  ): Promise<CallingList> {
    try {
      this.assertListManageRole(req.user);
      const assigned = await this.listsService.assignList(req.user, listId, dto.assigneeEmail);
      this.notificationsGateway.emitListAssigned({
        tenantId: req.user.tenantId,
        listId: assigned.id,
        listName: assigned.name,
        assigneeEmail: assigned.assigneeEmail ?? dto.assigneeEmail,
        assignedBy: req.user.email ?? '',
        assignedAt: assigned.assignedAt ?? new Date().toISOString(),
      });
      return assigned;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('リスト配布に失敗しました');
    }
  }

  @Post(':listId/unassign')
  async unassignList(@Req() req: JwtRequest, @Param('listId') listId: string): Promise<CallingList> {
    try {
      this.assertListManageRole(req.user);
      const unassignedResult = await this.listsService.unassignList(req.user, listId);
      this.notificationsGateway.emitListUnassigned({
        tenantId: req.user.tenantId,
        listId: unassignedResult.list.id,
        listName: unassignedResult.list.name,
        previousAssigneeEmail: unassignedResult.previousAssigneeEmail,
        unassignedBy: req.user.email ?? '',
        unassignedAt: new Date().toISOString(),
      });
      return unassignedResult.list;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('リスト配布解除に失敗しました');
    }
  }
}
