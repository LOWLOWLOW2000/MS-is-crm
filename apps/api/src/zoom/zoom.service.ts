import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import {
  CreateZoomDialSessionDto,
  ZoomDialSessionResultDto,
} from './dto/create-zoom-dial-session.dto';
import { ZoomUrlValidationResponseDto, ZoomWebhookDto } from './dto/zoom-webhook.dto';
import { ZoomCallLog } from './entities/zoom-call-log.entity';

@Injectable()
export class ZoomService {
  private readonly callLogs: ZoomCallLog[] = [];

  private readonly defaultTenantId = process.env.ZOOM_DEFAULT_TENANT_ID ?? 'tenant-demo-01';
  private readonly zoomAccountId = process.env.ZOOM_ACCOUNT_ID;
  private readonly zoomClientId = process.env.ZOOM_CLIENT_ID;
  private readonly zoomClientSecret = process.env.ZOOM_CLIENT_SECRET;
  private readonly zoomApiBaseUrl = process.env.ZOOM_API_BASE_URL ?? 'https://api.zoom.us/v2';

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

  private createFallbackDialSession = (
    user: JwtPayload,
    dto: CreateZoomDialSessionDto,
  ): ZoomDialSessionResultDto => {
    const meetingId = `${Date.now()}`.slice(-11);
    const topic = `${dto.companyName} 架電`;
    const scheduledAt = new Date().toISOString();
    const joinUrl = `https://zoom.us/j/${meetingId}`;

    const log: ZoomCallLog = {
      id: `zoom-dial-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId: user.tenantId,
      meetingId,
      meetingUuid: null,
      topic,
      hostEmail: user.email,
      status: 'started',
      startedAt: scheduledAt,
      endedAt: null,
      eventType: 'meeting.started.local_dial_fallback',
      receivedAt: scheduledAt,
    };
    this.callLogs.unshift(log);

    return {
      provider: 'zoom',
      meetingId,
      topic,
      joinUrl,
      startUrl: joinUrl,
      scheduledAt,
      isFallback: true,
    };
  };

  private fetchZoomAccessToken = async (): Promise<string | null> => {
    if (!this.zoomAccountId || !this.zoomClientId || !this.zoomClientSecret) {
      return null;
    }

    const credentials = Buffer.from(`${this.zoomClientId}:${this.zoomClientSecret}`).toString('base64');
    const response = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(this.zoomAccountId)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { access_token?: string };
    return data.access_token ?? null;
  };

  createDialSession = async (
    user: JwtPayload,
    dto: CreateZoomDialSessionDto,
  ): Promise<ZoomDialSessionResultDto> => {
    const topic = `${dto.companyName} 架電`;
    const scheduledAt = new Date().toISOString();
    const accessToken = await this.fetchZoomAccessToken();

    if (!accessToken) {
      return this.createFallbackDialSession(user, dto);
    }

    const response = await fetch(`${this.zoomApiBaseUrl}/users/me/meetings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        topic,
        type: 1,
        settings: {
          join_before_host: true,
          waiting_room: false,
          auto_recording: 'cloud',
        },
      }),
    });

    if (!response.ok) {
      return this.createFallbackDialSession(user, dto);
    }

    const data = (await response.json()) as {
      id?: number | string;
      join_url?: string;
      start_url?: string;
      start_time?: string;
      host_email?: string;
      uuid?: string;
      topic?: string;
    };

    const meetingId = data.id ? String(data.id) : `${Date.now()}`.slice(-11);
    const joinUrl = data.join_url ?? `https://zoom.us/j/${meetingId}`;
    const startUrl = data.start_url ?? joinUrl;
    const startTime = data.start_time ?? scheduledAt;

    const log: ZoomCallLog = {
      id: `zoom-dial-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId: user.tenantId,
      meetingId,
      meetingUuid: data.uuid ?? null,
      topic: data.topic ?? topic,
      hostEmail: data.host_email ?? user.email,
      status: 'started',
      startedAt: startTime,
      endedAt: null,
      eventType: 'meeting.started.api_dial',
      receivedAt: new Date().toISOString(),
    };
    this.callLogs.unshift(log);

    return {
      provider: 'zoom',
      meetingId,
      topic: data.topic ?? topic,
      joinUrl,
      startUrl,
      scheduledAt: startTime,
      isFallback: false,
    };
  };
}
