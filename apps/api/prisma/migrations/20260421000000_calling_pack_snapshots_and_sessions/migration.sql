-- 半自動架電: pack snapshot + session

-- AlterTable
ALTER TABLE "tenants"
ADD COLUMN     "callingScriptSnapshotId" TEXT,
ADD COLUMN     "callingDictionarySnapshotId" TEXT,
ADD COLUMN     "callingVoiceSnapshotId" TEXT;

-- CreateTable
CREATE TABLE "calling_pack_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body_json" JSONB NOT NULL,
    "createdAt" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "calling_pack_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calling_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TEXT NOT NULL,
    "endedAt" TEXT,
    "script_snapshot_json" JSONB NOT NULL,
    "dictionary_snapshot_json" JSONB NOT NULL,
    "voice_snapshot_json" JSONB NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "calling_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calling_pack_snapshots_tenantId_kind_idx" ON "calling_pack_snapshots"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "calling_pack_snapshots_tenantId_createdAt_idx" ON "calling_pack_snapshots"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "calling_sessions_tenantId_idx" ON "calling_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "calling_sessions_tenantId_createdAt_idx" ON "calling_sessions"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "calling_pack_snapshots" ADD CONSTRAINT "calling_pack_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calling_sessions" ADD CONSTRAINT "calling_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (published snapshot pointers)
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_callingScriptSnapshotId_fkey" FOREIGN KEY ("callingScriptSnapshotId") REFERENCES "calling_pack_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_callingDictionarySnapshotId_fkey" FOREIGN KEY ("callingDictionarySnapshotId") REFERENCES "calling_pack_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_callingVoiceSnapshotId_fkey" FOREIGN KEY ("callingVoiceSnapshotId") REFERENCES "calling_pack_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

