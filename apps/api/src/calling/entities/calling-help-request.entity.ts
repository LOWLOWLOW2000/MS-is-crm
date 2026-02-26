export type HelpRequestStatus = 'waiting' | 'joined' | 'closed';

export interface CallingHelpRequest {
  id: string;
  tenantId: string;
  requestedBy: string;
  requestedByEmail: string;
  companyName: string;
  scriptTab: string;
  requestedAt: string;
  queueNumber: number;
  status: HelpRequestStatus;
  joinedBy: string | null;
  joinedAt: string | null;
  resolvedAt: string | null;
}

