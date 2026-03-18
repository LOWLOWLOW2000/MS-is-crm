export interface ListItem {
  id: string;
  tenantId: string;
  listId: string;
  companyName: string;
  phone: string;
  address: string;
  targetUrl: string;
  industryTag: string | null;
  assignedToUserId: string | null;
  assignedAt: string | null;
  assignedByUserId: string | null;
  status: string;
  statusUpdatedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
