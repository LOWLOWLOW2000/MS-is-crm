export interface ZoomCallLog {
  id: string;
  tenantId: string;
  meetingId: string | null;
  meetingUuid: string | null;
  topic: string | null;
  hostEmail: string | null;
  status: 'started' | 'ended';
  startedAt: string | null;
  endedAt: string | null;
  eventType: string;
  receivedAt: string;
}
