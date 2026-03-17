-- 企業データベース・論理ツリー（L1〜L5）
-- L1: 企業グループ
CREATE TABLE "company_groups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "listedFlag" TEXT,
    "creditInfo" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "company_groups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_groups_tenantId_idx" ON "company_groups"("tenantId");

-- L2: 法人エンティティ
CREATE TABLE "legal_entities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyGroupId" TEXT,
    "corporateNumber" TEXT,
    "name" TEXT NOT NULL,
    "headOfficeAddress" TEXT,
    "establishedAt" TEXT,
    "capital" TEXT,
    "revenue" TEXT,
    "operatingProfit" TEXT,
    "fiscalYearEnd" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "legal_entities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "legal_entities_tenantId_idx" ON "legal_entities"("tenantId");
CREATE INDEX "legal_entities_companyGroupId_idx" ON "legal_entities"("companyGroupId");

ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_companyGroupId_fkey" FOREIGN KEY ("companyGroupId") REFERENCES "company_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- L3: 拠点・事業所
CREATE TABLE "establishments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "type" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "establishments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "establishments_tenantId_idx" ON "establishments"("tenantId");
CREATE INDEX "establishments_legalEntityId_idx" ON "establishments"("legalEntityId");

ALTER TABLE "establishments" ADD CONSTRAINT "establishments_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- L4: 組織・部署
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleCategory" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "departments_tenantId_idx" ON "departments"("tenantId");
CREATE INDEX "departments_legalEntityId_idx" ON "departments"("legalEntityId");

ALTER TABLE "departments" ADD CONSTRAINT "departments_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- L5: 担当者・キーマン
CREATE TABLE "personas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "departmentId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "roleRank" TEXT,
    "authority" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "personas_tenantId_idx" ON "personas"("tenantId");
CREATE INDEX "personas_legalEntityId_idx" ON "personas"("legalEntityId");
CREATE INDEX "personas_departmentId_idx" ON "personas"("departmentId");

ALTER TABLE "personas" ADD CONSTRAINT "personas_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "personas" ADD CONSTRAINT "personas_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- list_items に legal_entity_id を追加
ALTER TABLE "list_items" ADD COLUMN "legalEntityId" TEXT;

CREATE INDEX "list_items_legalEntityId_idx" ON "list_items"("legalEntityId");

ALTER TABLE "list_items" ADD CONSTRAINT "list_items_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
