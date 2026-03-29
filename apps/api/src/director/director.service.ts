import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CallingService } from '../calling/calling.service';
import { CallingHelpRequest } from '../calling/entities/calling-help-request.entity';
import { hasAnyRole } from '../common/auth/role-utils';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UserRole } from '../common/enums/user-role.enum';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PrismaService } from '../prisma/prisma.service';
import type { DirectorOverviewDto } from './dto/director-overview.dto';

@Injectable()
export class DirectorService {
  constructor(
    private readonly callingService: CallingService,
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  private assertDirectorRole = (user: JwtPayload): void => {
    const ok = hasAnyRole(user, [
      UserRole.Director,
      UserRole.IsAdmin,
      UserRole.Developer,
      UserRole.EnterpriseAdmin,
    ]);
    if (!ok) {
      throw new ForbiddenException('ディレクターダッシュボードには director / is_admin / enterprise_admin / developer のみアクセスできます');
    }
  };

  /**
   * ディレクター用概要: ヘルプリクエスト一覧・待機キュー・IS名の補完
   */
  getOverview = async (user: JwtPayload): Promise<DirectorOverviewDto> => {
    this.assertDirectorRole(user);

    const [helpRequests, waitingQueue] = await Promise.all([
      this.callingService.getRecentHelpRequests(user),
      this.callingService.getWaitingQueue(user),
    ]);

    const requestedByIds = [...new Set(helpRequests.map((r) => r.requestedBy))];
    const userRows =
      requestedByIds.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: { id: { in: requestedByIds }, tenantId: user.tenantId },
            select: { id: true, name: true },
          });
    const nameByUserId = new Map(userRows.map((r) => [r.id, r.name]));

    const enriched = helpRequests.map((r) => ({
      ...r,
      requestedByName: nameByUserId.get(r.requestedBy) ?? undefined,
    }));

    return {
      helpRequests: enriched,
      waitingCount: waitingQueue.length,
      waitingQueue,
    };
  };

  /** Phase2: ディレクターがISにテキスト囁きを送る。requestId でヘルプリクエストを特定し、requestedBy が受け取り先 */
  sendWhisper = async (user: JwtPayload, requestId: string, message: string): Promise<{ ok: true }> => {
    this.assertDirectorRole(user);
    const trimmed = message?.trim() ?? '';
    if (trimmed.length === 0) {
      throw new ForbiddenException('メッセージを入力してください');
    }
    const request = await this.prisma.callingHelpRequest.findFirst({
      where: { id: requestId, tenantId: user.tenantId },
    });
    if (!request) {
      throw new NotFoundException('対象の呼出リクエストが見つかりません');
    }
    const sentAt = new Date().toISOString();
    this.notificationsGateway.emitDirectorMessage({
      requestId,
      tenantId: user.tenantId,
      toUserId: request.requestedBy,
      fromUserId: user.sub,
      message: trimmed,
      sentAt,
    });
    return { ok: true };
  };

  getRequestsSummary = async (user: JwtPayload): Promise<{
    unreadTotal: number
    unreadAppointment: number
    unreadMaterial: number
  }> => {
    this.assertDirectorRole(user)

    const rows = await this.prisma.callingRecord.findMany({
      where: {
        tenantId: user.tenantId,
        result: { in: ['アポ', '資料送付'] },
        directorReadAt: null,
      },
      select: { result: true },
    })
    const unreadAppointment = rows.filter((r) => r.result === 'アポ').length
    const unreadMaterial = rows.filter((r) => r.result === '資料送付').length
    return {
      unreadTotal: unreadAppointment + unreadMaterial,
      unreadAppointment,
      unreadMaterial,
    }
  }

  getRequests = async (
    user: JwtPayload,
  ): Promise<
    {
      id: string
      type: 'appointment' | 'material'
      resultCapturedAt: string
      companyName: string
      targetUrl: string
      memo: string
      createdByUserId: string
      createdByName?: string
      isRead: boolean
      directorReadAt: string | null
    }[]
  > => {
    this.assertDirectorRole(user)

    const rows = await this.prisma.callingRecord.findMany({
      where: {
        tenantId: user.tenantId,
        result: { in: ['アポ', '資料送付'] },
      },
      orderBy: { resultCapturedAt: 'desc' },
      take: 200,
      select: {
        callingHistoryId: true,
        resultCapturedAt: true,
        companyName: true,
        targetUrl: true,
        memo: true,
        createdBy: true,
        result: true,
        directorReadAt: true,
      },
    })

    const createdByIds = [...new Set(rows.map((r) => r.createdBy))]
    const users =
      createdByIds.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: { tenantId: user.tenantId, id: { in: createdByIds } },
            select: { id: true, name: true },
          })
    const nameById = new Map(users.map((u) => [u.id, u.name]))

    return rows.map((r) => ({
      id: r.callingHistoryId,
      type: r.result === 'アポ' ? 'appointment' : 'material',
      resultCapturedAt: r.resultCapturedAt,
      companyName: r.companyName,
      targetUrl: r.targetUrl,
      memo: r.memo,
      createdByUserId: r.createdBy,
      createdByName: nameById.get(r.createdBy) ?? undefined,
      isRead: r.directorReadAt != null,
      directorReadAt: r.directorReadAt,
    }))
  }

  markRequestsAsRead = async (
    user: JwtPayload,
    body: { ids?: string[]; markAll?: boolean },
  ): Promise<{ updated: number }> => {
    this.assertDirectorRole(user)

    const nowIso = new Date().toISOString()
    const markAll = body.markAll === true
    const ids = Array.isArray(body.ids) ? body.ids.filter((v) => typeof v === 'string' && v.trim().length > 0) : []

    if (!markAll && ids.length === 0) {
      throw new BadRequestException('ids または markAll=true を指定してください')
    }

    const whereBase = {
      tenantId: user.tenantId,
      result: { in: ['アポ', '資料送付'] as string[] },
      directorReadAt: null as null,
    }

    const result = await this.prisma.callingRecord.updateMany({
      where: markAll ? whereBase : { ...whereBase, callingHistoryId: { in: ids } },
      data: {
        directorReadAt: nowIso,
        directorReadBy: user.sub,
        updatedAt: nowIso,
      },
    })

    return { updated: result.count }
  }
}
