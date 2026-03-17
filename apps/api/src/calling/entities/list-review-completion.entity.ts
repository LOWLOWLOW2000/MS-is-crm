/** リスト精査終了（リスト確認が承認終わった時点）。id = リスト精査終了ID、reviewCompletedAt = リスト精査終了日 */
export interface ListReviewCompletion {
  /** リスト精査終了ID */
  id: string
  tenantId: string
  /** リスト精査を完了したユーザーID */
  completedBy: string
  /** リスト精査終了日 */
  reviewCompletedAt: string
  targetUrl: string
  companyName: string
}
