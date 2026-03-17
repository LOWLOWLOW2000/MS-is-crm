-- 承認 → リスト精査終了（リスト精査終了ID・リスト精査終了日）
-- テーブル名変更、カラム名変更
ALTER TABLE "calling_approvals" RENAME TO "list_review_completions";
ALTER TABLE "list_review_completions" RENAME COLUMN "approvedBy" TO "completedBy";
ALTER TABLE "list_review_completions" RENAME COLUMN "approvedAt" TO "reviewCompletedAt";
