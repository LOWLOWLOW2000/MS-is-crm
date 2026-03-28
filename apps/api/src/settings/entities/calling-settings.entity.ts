export interface CallingSettings {
  tenantId: string;
  humanApprovalEnabled: boolean;
  /** mock | zoom_embed | external_url | webhook */
  callProviderKind: string;
  callProviderConfig: Record<string, unknown> | null;
  /** ISO 8601。設定済みなら架電ルームの承認ボタンをテナント全員で非表示 */
  salesRoomContentAckAt: string | null;
  salesRoomContentAckBy: string | null;
  updatedBy: string;
  updatedAt: string;
}
