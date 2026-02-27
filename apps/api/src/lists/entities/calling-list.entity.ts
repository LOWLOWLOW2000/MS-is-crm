export interface CallingList {
  id: string;
  tenantId: string;
  name: string;
  sourceType: 'csv';
  createdBy: string;
  createdAt: string;
  itemCount: number;
  assigneeEmail: string | null;
  assignedAt: string | null;
}
