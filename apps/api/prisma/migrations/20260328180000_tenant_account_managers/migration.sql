-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "accountManagerUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
