import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CallingService } from '../calling/calling.service';
import { CallingHelpRequest } from '../calling/entities/calling-help-request.entity';
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
    if (user.role !== UserRole.Director && user.role !== UserRole.IsAdmin && user.role !== UserRole.Developer && user.role !== UserRole.EnterpriseAdmin) {
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
}
