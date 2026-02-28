import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_TENANT = 'tenant-demo-01';
const DEV_PASSWORD = 'ChangeMe123!';

const demoUsers = [
  { email: 'developer@example.com', name: 'Developer User', role: 'developer' },
  { email: 'isadmin@example.com', name: 'IS Admin User', role: 'is_admin' },
  { email: 'member@example.com', name: 'IS Member User', role: 'is_member' },
  { email: 'director@example.com', name: 'Director User', role: 'director' },
  { email: 'company@example.com', name: 'Company Admin User', role: 'enterprise_admin' },
];

async function main(): Promise<void> {
  const hashedPassword = await bcrypt.hash(DEV_PASSWORD, 10);
  const now = new Date().toISOString();

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: DEMO_TENANT, email: u.email },
      },
      create: {
        tenantId: DEMO_TENANT,
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        name: u.name,
        role: u.role,
        passwordHash: hashedPassword,
        updatedAt: now,
      },
    });
  }

  console.log('Seed: demo users upserted.');

  // リスト生成用マスタ（デモ用・選択式で使う）
  const areas = ['東京都', '大阪府', '神奈川県'];
  for (const name of areas) {
    await prisma.listAreaMaster.upsert({
      where: { tenantId_name: { tenantId: DEMO_TENANT, name } },
      create: { tenantId: DEMO_TENANT, name, isActive: true, createdAt: now, updatedAt: now },
      update: { isActive: true, updatedAt: now },
    });
  }
  const industries = ['IT・ソフトウェア', '製造業', '小売'];
  for (const name of industries) {
    await prisma.listIndustryMaster.upsert({
      where: { tenantId_name: { tenantId: DEMO_TENANT, name } },
      create: { tenantId: DEMO_TENANT, name, isActive: true, createdAt: now, updatedAt: now },
      update: { isActive: true, updatedAt: now },
    });
  }
  const keywords = ['BtoB', '従業員50人以上', '上場企業'];
  for (const name of keywords) {
    await prisma.listKeywordMaster.upsert({
      where: { tenantId_name: { tenantId: DEMO_TENANT, name } },
      create: { tenantId: DEMO_TENANT, name, isActive: true, createdAt: now, updatedAt: now },
      update: { isActive: true, updatedAt: now },
    });
  }
  console.log('Seed: list masters (area, industry, keyword) upserted.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
