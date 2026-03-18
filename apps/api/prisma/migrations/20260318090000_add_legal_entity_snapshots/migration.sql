-- LegalEntity に status を追加（画面用ステータス）
ALTER TABLE "legal_entities" ADD COLUMN "status" TEXT;

-- 会社情報の更新履歴（スナップショット）
CREATE TABLE "legal_entity_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "legal_entity_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "legal_entity_snapshots_tenantId_idx" ON "legal_entity_snapshots"("tenantId");
CREATE INDEX "legal_entity_snapshots_legalEntityId_idx" ON "legal_entity_snapshots"("legalEntityId");
CREATE INDEX "legal_entity_snapshots_tenantId_legalEntityId_createdAt_idx" ON "legal_entity_snapshots"("tenantId", "legalEntityId", "createdAt");

ALTER TABLE "legal_entity_snapshots"
ADD CONSTRAINT "legal_entity_snapshots_legalEntityId_fkey"
FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

