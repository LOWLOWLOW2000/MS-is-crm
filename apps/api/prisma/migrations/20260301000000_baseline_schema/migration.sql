-- 空DB向けベースライン（従来マイグレーションはシャドウDBで前提テーブル欠落のため統合）
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calling_records" (
    "calling_history_id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyPhone" TEXT NOT NULL,
    "companyAddress" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "approvedAt" TEXT,
    "approvedBy" TEXT,
    "result" TEXT NOT NULL,
    "memo" TEXT NOT NULL DEFAULT '',
    "nextCallAt" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "calling_records_pkey" PRIMARY KEY ("calling_history_id")
);

-- CreateTable
CREATE TABLE "list_review_completions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "completedBy" TEXT NOT NULL,
    "reviewCompletedAt" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,

    CONSTRAINT "list_review_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calling_help_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedByEmail" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "scriptTab" TEXT NOT NULL,
    "requestedAt" TEXT NOT NULL,
    "queueNumber" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "joinedBy" TEXT,
    "joinedAt" TEXT,
    "resolvedAt" TEXT,

    CONSTRAINT "calling_help_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calling_settings" (
    "tenantId" TEXT NOT NULL,
    "humanApprovalEnabled" BOOLEAN NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "calling_settings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "calling_lists" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'csv',
    "createdBy" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "assigneeEmail" TEXT,
    "assignedBy" TEXT,
    "assignedAt" TEXT,

    CONSTRAINT "calling_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "legalEntityId" TEXT,
    "companyName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "industryTag" TEXT,
    "assignedToUserId" TEXT,
    "assignedAt" TEXT,
    "assignedByUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unstarted',
    "statusUpdatedAt" TEXT,
    "completedAt" TEXT,
    "aiListTier" TEXT,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "legal_entities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyGroupId" TEXT,
    "corporateNumber" TEXT,
    "name" TEXT NOT NULL,
    "headOfficeAddress" TEXT,
    "status" TEXT,
    "establishedAt" TEXT,
    "capital" TEXT,
    "revenue" TEXT,
    "operatingProfit" TEXT,
    "fiscalYearEnd" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "legal_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_entity_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "legal_entity_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "personas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "departmentId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "roleRank" TEXT,
    "authority" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industryTag" TEXT,
    "tabs" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "script_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calling_ai_evaluations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "callRecordId" TEXT NOT NULL,
    "evaluatedAt" TEXT NOT NULL,
    "categoryScores" JSONB NOT NULL,
    "summary" TEXT,
    "improvementPoints" JSONB,

    CONSTRAINT "calling_ai_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_transcriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "callRecordId" TEXT NOT NULL,
    "zoomMeetingId" TEXT,
    "recordingStorageUrl" TEXT,
    "durationSeconds" INTEGER,
    "transcribedAt" TEXT NOT NULL,
    "transcriptionText" TEXT NOT NULL DEFAULT '',
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "call_transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_area_masters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "list_area_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_industry_masters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "list_industry_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_keyword_masters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "list_keyword_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_generation_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedByEmail" TEXT NOT NULL,
    "assignedToEmail" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "resultListId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "list_generation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_list_generation_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requesterRole" TEXT NOT NULL,
    "inputMasked" JSONB NOT NULL,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "operator_list_generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxUsers" INTEGER,
    "maxLists" INTEGER,
    "features" JSONB,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tenantId_idx" ON "refresh_tokens"("tenantId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tokenHash_idx" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "calling_records_tenantId_idx" ON "calling_records"("tenantId");

-- CreateIndex
CREATE INDEX "calling_records_tenantId_nextCallAt_idx" ON "calling_records"("tenantId", "nextCallAt");

-- CreateIndex
CREATE INDEX "list_review_completions_tenantId_idx" ON "list_review_completions"("tenantId");

-- CreateIndex
CREATE INDEX "calling_help_requests_tenantId_idx" ON "calling_help_requests"("tenantId");

-- CreateIndex
CREATE INDEX "calling_help_requests_tenantId_status_idx" ON "calling_help_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "calling_lists_tenantId_idx" ON "calling_lists"("tenantId");

-- CreateIndex
CREATE INDEX "list_items_tenantId_idx" ON "list_items"("tenantId");

-- CreateIndex
CREATE INDEX "list_items_listId_idx" ON "list_items"("listId");

-- CreateIndex
CREATE INDEX "list_items_legalEntityId_idx" ON "list_items"("legalEntityId");

-- CreateIndex
CREATE INDEX "list_items_tenantId_assignedToUserId_idx" ON "list_items"("tenantId", "assignedToUserId");

-- CreateIndex
CREATE INDEX "list_items_tenantId_status_idx" ON "list_items"("tenantId", "status");

-- CreateIndex
CREATE INDEX "company_groups_tenantId_idx" ON "company_groups"("tenantId");

-- CreateIndex
CREATE INDEX "legal_entities_tenantId_idx" ON "legal_entities"("tenantId");

-- CreateIndex
CREATE INDEX "legal_entities_companyGroupId_idx" ON "legal_entities"("companyGroupId");

-- CreateIndex
CREATE INDEX "legal_entity_snapshots_tenantId_idx" ON "legal_entity_snapshots"("tenantId");

-- CreateIndex
CREATE INDEX "legal_entity_snapshots_legalEntityId_idx" ON "legal_entity_snapshots"("legalEntityId");

-- CreateIndex
CREATE INDEX "legal_entity_snapshots_tenantId_legalEntityId_createdAt_idx" ON "legal_entity_snapshots"("tenantId", "legalEntityId", "createdAt");

-- CreateIndex
CREATE INDEX "establishments_tenantId_idx" ON "establishments"("tenantId");

-- CreateIndex
CREATE INDEX "establishments_legalEntityId_idx" ON "establishments"("legalEntityId");

-- CreateIndex
CREATE INDEX "departments_tenantId_idx" ON "departments"("tenantId");

-- CreateIndex
CREATE INDEX "departments_legalEntityId_idx" ON "departments"("legalEntityId");

-- CreateIndex
CREATE INDEX "personas_tenantId_idx" ON "personas"("tenantId");

-- CreateIndex
CREATE INDEX "personas_legalEntityId_idx" ON "personas"("legalEntityId");

-- CreateIndex
CREATE INDEX "personas_departmentId_idx" ON "personas"("departmentId");

-- CreateIndex
CREATE INDEX "script_templates_tenantId_idx" ON "script_templates"("tenantId");

-- CreateIndex
CREATE INDEX "calling_ai_evaluations_tenantId_idx" ON "calling_ai_evaluations"("tenantId");

-- CreateIndex
CREATE INDEX "calling_ai_evaluations_callRecordId_idx" ON "calling_ai_evaluations"("callRecordId");

-- CreateIndex
CREATE INDEX "call_transcriptions_tenantId_idx" ON "call_transcriptions"("tenantId");

-- CreateIndex
CREATE INDEX "call_transcriptions_callRecordId_idx" ON "call_transcriptions"("callRecordId");

-- CreateIndex
CREATE INDEX "list_area_masters_tenantId_idx" ON "list_area_masters"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "list_area_masters_tenantId_name_key" ON "list_area_masters"("tenantId", "name");

-- CreateIndex
CREATE INDEX "list_industry_masters_tenantId_idx" ON "list_industry_masters"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "list_industry_masters_tenantId_name_key" ON "list_industry_masters"("tenantId", "name");

-- CreateIndex
CREATE INDEX "list_keyword_masters_tenantId_idx" ON "list_keyword_masters"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "list_keyword_masters_tenantId_name_key" ON "list_keyword_masters"("tenantId", "name");

-- CreateIndex
CREATE INDEX "list_generation_requests_tenantId_idx" ON "list_generation_requests"("tenantId");

-- CreateIndex
CREATE INDEX "list_generation_requests_tenantId_status_idx" ON "list_generation_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "list_generation_requests_tenantId_assignedToEmail_idx" ON "list_generation_requests"("tenantId", "assignedToEmail");

-- CreateIndex
CREATE INDEX "operator_list_generation_logs_tenantId_idx" ON "operator_list_generation_logs"("tenantId");

-- CreateIndex
CREATE INDEX "tenants_planId_idx" ON "tenants"("planId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_listId_fkey" FOREIGN KEY ("listId") REFERENCES "calling_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_companyGroupId_fkey" FOREIGN KEY ("companyGroupId") REFERENCES "company_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_entity_snapshots" ADD CONSTRAINT "legal_entity_snapshots_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "establishments" ADD CONSTRAINT "establishments_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
