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
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
