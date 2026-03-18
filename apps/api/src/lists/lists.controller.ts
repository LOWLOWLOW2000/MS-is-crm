import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { ImportListCsvDto } from './dto/import-list-csv.dto';
import { ImportListResultDto } from './dto/import-list-result.dto';
import { AssignListDto } from './dto/assign-list.dto';
import { DistributeListItemsDto } from './dto/distribute-list-items.dto';
import { RecallListItemsDto } from './dto/recall-list-items.dto';
import { UpdateListItemStatusDto } from './dto/update-list-item-status.dto';
import { CallingList } from './entities/calling-list.entity';
import { ListItem } from './entities/list-item.entity';
import { ListsService } from './lists.service';

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
    if (user.role === UserRole.IsMember) {
      throw new ForbiddenException('is_member はリスト管理にアクセスできません');
    }
  };

  private assertDirectorRole = (user: JwtPayload): void => {
    const ok =
      user.role === UserRole.Developer ||
      user.role === UserRole.EnterpriseAdmin ||
      user.role === UserRole.IsAdmin ||
      user.role === UserRole.Director;
    if (!ok) {
      throw new ForbiddenException('ディレクター権限が必要です');
    }
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
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('CSVインポートに失敗しました');
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

  @Get(':listId/items')
  async getListItems(@Req() req: JwtRequest, @Param('listId') listId: string): Promise<ListItem[]> {
    try {
      if (req.user.role === UserRole.IsMember) {
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
      return await this.listsService.distributeListItemsEven(req.user, listId, dto.assigneeUserIds);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('配布に失敗しました');
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
