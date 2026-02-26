export interface CallingHelpRequest {
  id: string;
  tenantId: string;
  requestedBy: string;
  companyName: string;
  scriptTab: string;
  requestedAt: string;
  queueNumber: number;
}

