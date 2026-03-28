export interface ListItem {
  id: string;
  tenantId: string;
  listId: string;
  /** 親リストの表示名（ディレクターが命名・格納時） */
  listName: string | null;
  /** 架電ルームで記録した最新の架電結果（正規名） */
  callingResult: string | null;
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
