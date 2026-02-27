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
import { ImportListCsvDto } from './dto/import-list-csv.dto';
import { ImportListResultDto } from './dto/import-list-result.dto';
import { CallingList } from './entities/calling-list.entity';
import { ListItem } from './entities/list-item.entity';
import { ListsService } from './lists.service';

interface JwtRequest extends Request {
  user: JwtPayload;
}

@Controller('lists')
@UseGuards(JwtAuthGuard)
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  private assertListManageRole = (user: JwtPayload): void => {
    if (user.role === UserRole.IsMember) {
      throw new ForbiddenException('is_member はリスト管理にアクセスできません');
    }
  };

  @Post('import-csv')
  importCsv(@Req() req: JwtRequest, @Body() dto: ImportListCsvDto): ImportListResultDto {
    try {
      this.assertListManageRole(req.user);
      return this.listsService.importCsv(req.user, dto);
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

  @Get(':listId/items')
  getListItems(@Req() req: JwtRequest, @Param('listId') listId: string): ListItem[] {
    try {
      this.assertListManageRole(req.user);
      return this.listsService.getListItems(req.user, listId);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('リスト明細の取得に失敗しました');
    }
  }
}
