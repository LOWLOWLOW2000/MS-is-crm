import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { ZoomUrlValidationResponseDto, ZoomWebhookDto } from './dto/zoom-webhook.dto';
import { ZoomCallLog } from './entities/zoom-call-log.entity';

@Injectable()
export class ZoomService {
  private readonly callLogs: ZoomCallLog[] = [];

  private readonly defaultTenantId = process.env.ZOOM_DEFAULT_TENANT_ID ?? 'tenant-demo-01';

  private resolveTenantId = (dto: ZoomWebhookDto): string => {
    const fromCustomKey = dto.payload?.object?.custom_keys?.tenantId;
    if (fromCustomKey && fromCustomKey.trim().length > 0) {
      return fromCustomKey;
    }

    const fromAccount = dto.payload?.account_id ?? dto.payload?.object?.account_id;
    if (fromAccount && fromAccount.trim().length > 0) {
      return `${this.defaultTenantId}`;
    }

    return this.defaultTenantId;
  };

  verifyWebhookToken = (authorizationHeader: string | undefined): boolean => {
    const verificationToken = process.env.ZOOM_WEBHOOK_VERIFICATION_TOKEN;
    if (!verificationToken) {
      return true;
    }

    const expected = `Bearer ${verificationToken}`;
    return authorizationHeader === expected;
  };

  buildUrlValidationResponse = (dto: ZoomWebhookDto): ZoomUrlValidationResponseDto | null => {
    if (dto.event !== 'endpoint.url_validation') {
      return null;
    }

    const plainToken = dto.payload?.plainToken;
    if (!plainToken) {
      return null;
    }

    const secretToken = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
    if (!secretToken) {
      return null;
    }

    const encryptedToken = createHmac('sha256', secretToken).update(plainToken).digest('hex');

    return {
      plainToken,
      encryptedToken,
    };
  };

  handleWebhookEvent = (dto: ZoomWebhookDto): ZoomCallLog | null => {
    const eventType = dto.event ?? 'unknown';
    const tenantId = this.resolveTenantId(dto);
    const object = dto.payload?.object;
    const meetingId = object?.id ? String(object.id) : null;
    const meetingUuid = object?.uuid ?? null;
    const topic = object?.topic ?? null;
    const hostEmail = object?.host_email ?? null;
    const nowIso = new Date().toISOString();

    if (eventType !== 'meeting.started' && eventType !== 'meeting.ended') {
      return null;
    }

    if (eventType === 'meeting.started') {
      const log: ZoomCallLog = {
        id: `zoom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tenantId,
        meetingId,
        meetingUuid,
        topic,
        hostEmail,
        status: 'started',
        startedAt: object?.start_time ?? nowIso,
        endedAt: null,
        eventType,
        receivedAt: nowIso,
      };

      this.callLogs.unshift(log);
      return log;
    }

    const found = this.callLogs.find((log) => {
      return (
        log.tenantId === tenantId &&
        ((meetingUuid && log.meetingUuid === meetingUuid) || (meetingId && log.meetingId === meetingId)) &&
        log.status === 'started'
      );
    });

    if (found) {
      found.status = 'ended';
      found.endedAt = object?.end_time ?? nowIso;
      found.eventType = eventType;
      found.receivedAt = nowIso;
      return found;
    }

    const log: ZoomCallLog = {
      id: `zoom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId,
      meetingId,
      meetingUuid,
      topic,
      hostEmail,
      status: 'ended',
      startedAt: null,
      endedAt: object?.end_time ?? nowIso,
      eventType,
      receivedAt: nowIso,
    };
    this.callLogs.unshift(log);
    return log;
  };

  getRecentCallLogs = (user: JwtPayload): ZoomCallLog[] => {
    return this.callLogs
      .filter((log) => log.tenantId === user.tenantId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .slice(0, 50);
  };
}
