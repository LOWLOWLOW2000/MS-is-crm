export interface ListItem {
  id: string;
  tenantId: string;
  listId: string;
  companyName: string;
  phone: string;
  address: string;
  targetUrl: string;
  industryTag: string | null;
  createdAt: string;
}
