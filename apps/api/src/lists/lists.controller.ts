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

  @Post('import-csv')
  importCsv(@Req() req: JwtRequest, @Body() dto: ImportListCsvDto): ImportListResultDto {
    try {
      this.assertListManageRole(req.user);
      const result = this.listsService.importCsv(req.user, dto);
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
  getLists(@Req() req: JwtRequest): CallingList[] {
    try {
      this.assertListManageRole(req.user);
      return this.listsService.getLists(req.user);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('リスト一覧の取得に失敗しました');
    }
  }

  @Get('assigned/me')
  getMyAssignedLists(@Req() req: JwtRequest): CallingList[] {
    try {
      return this.listsService.getAssignedLists(req.user);
    } catch {
      throw new InternalServerErrorException('配布リストの取得に失敗しました');
    }
  }

  @Get(':listId/items')
  getListItems(@Req() req: JwtRequest, @Param('listId') listId: string): ListItem[] {
    try {
      if (req.user.role === UserRole.IsMember) {
        return this.listsService.getAssignedListItems(req.user, listId);
      }
      return this.listsService.getListItems(req.user, listId);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('リスト明細の取得に失敗しました');
    }
  }

  @Post(':listId/assign')
  assignList(
    @Req() req: JwtRequest,
    @Param('listId') listId: string,
    @Body() dto: AssignListDto,
  ): CallingList {
    try {
      this.assertListManageRole(req.user);
      const assigned = this.listsService.assignList(req.user, listId, dto.assigneeEmail);
      this.notificationsGateway.emitListAssigned({
        tenantId: req.user.tenantId,
        listId: assigned.id,
        listName: assigned.name,
        assigneeEmail: assigned.assigneeEmail ?? dto.assigneeEmail,
        assignedBy: req.user.email,
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
}
