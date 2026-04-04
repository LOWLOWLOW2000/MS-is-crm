import path from 'path'
import { config } from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/generated/prisma/client'
import { UserRole as UR } from '../../src/common/enums/user-role.enum'
import { ensureDefaultProjectInTx, upsertProjectMembershipInTx } from '../../src/users/project-membership.helper'

config({
  path: path.resolve(__dirname, '..', '..', '.env'),
  override: process.env.NODE_ENV === 'production' ? false : true,
})

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

async function main(): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true } })
  const roleValues = new Set<string>(Object.values(UR))

  for (const { id: tenantId } of tenants) {
    await prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({ where: { tenantId } })

      for (const u of users) {
        const raw = u.roles && u.roles.length > 0 ? u.roles : [u.role]
        const roles = raw.filter((x): x is UR => typeof x === 'string' && roleValues.has(x))

        if (roles.length === 0) continue

        await upsertProjectMembershipInTx(tx, { tenantId, userId: u.id, roles })
      }
    })
  }

  console.log('Sync: project_memberships synced for all tenants.')
}

void main().finally(async () => {
  await prisma.$disconnect()
})

