import { Prisma } from '../generated/prisma/client';
import { UserRole as UR } from '../common/enums/user-role.enum';

/** 管理画面の IS 専用枠と同じ判定で PJ 配役を決定 */
export const pjRoleForUserRoles = (roles: UR[]): 'director' | 'is_member' => {
  if (
    roles.includes(UR.IsMember) &&
    !roles.includes(UR.Director) &&
    !roles.some((r) =>
      [UR.IsAdmin, UR.Developer].includes(r),
    )
  ) {
    return 'is_member';
  }
  return 'director';
};

type Tx = Prisma.TransactionClient;

/**
 * テナントの既定PJ（1テナント1件）を確保。表示名は projectDisplayName → companyName → name → PJ
 */
export const ensureDefaultProjectInTx = async (
  tx: Tx,
  tenantId: string,
): Promise<{ id: string; name: string }> => {
  const existing = await tx.project.findUnique({
    where: { tenantId },
    select: { id: true, name: true },
  });
  if (existing) {
    return existing;
  }
  const tenant = await tx.tenant.findUnique({
    where: { id: tenantId },
    select: {
      projectDisplayName: true,
      companyName: true,
      name: true,
    },
  });
  const label =
    [tenant?.projectDisplayName, tenant?.companyName, tenant?.name]
      .map((s) => (s ?? '').trim())
      .find((s) => s.length > 0) ?? 'PJ';
  const now = new Date().toISOString();
  return tx.project.create({
    data: {
      tenantId,
      name: label,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true, name: true },
  });
};

/** User.roles 更新後に PJ 配役行を upsert（tenantId フィルタ必須） */
export const upsertProjectMembershipInTx = async (
  tx: Tx,
  params: { tenantId: string; userId: string; roles: UR[] },
): Promise<void> => {
  const { tenantId, userId, roles } = params;
  const project = await ensureDefaultProjectInTx(tx, tenantId);
  const pjRole = pjRoleForUserRoles(roles);
  const now = new Date().toISOString();
  await tx.projectMembership.upsert({
    where: {
      projectId_userId: { projectId: project.id, userId },
    },
    create: {
      tenantId,
      projectId: project.id,
      userId,
      pjRole,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      pjRole,
      updatedAt: now,
    },
  });
};
