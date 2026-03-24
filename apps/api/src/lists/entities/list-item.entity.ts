export interface ListItem {
  id: string;
  tenantId: string;
  listId: string;
  companyName: string;
  phone: string;
  address: string;
  /** 企業（Legal Entity）ID。persona（担当者）の紐付けに利用 */
  legalEntityId: string | null;
  targetUrl: string;
  industryTag: string | null;
  assignedToUserId: string | null;
  assignedAt: string | null;
  assignedByUserId: string | null;
  status: string;
  statusUpdatedAt: string | null;
  completedAt: string | null;
  /** AIリスト判定 A|B|C */
  aiListTier: string | null;
  createdAt: string;
}
