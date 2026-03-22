type RowWithPm = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  roles: string[];
  profileImageUrl: string | null;
  countryCode: string | null;
  prefecture: string | null;
  mobilePhone: string | null;
  createdAt: string;
  projectMemberships: {
    pjRole: string;
    project: { id: string; name: string };
  }[];
};

export type UserListApiRow = Omit<RowWithPm, 'projectMemberships'> & {
  projectAssignment: {
    projectId: string;
    projectName: string;
    pjRole: 'director' | 'is_member';
  } | null;
};

/** GET /users・PATCH tier のレスポンス形へ整形 */
export const toUserListApiRow = (row: RowWithPm): UserListApiRow => {
  const { projectMemberships, ...rest } = row;
  const pm = projectMemberships[0];
  if (!pm) {
    return { ...rest, projectAssignment: null };
  }
  const pj: 'director' | 'is_member' =
    pm.pjRole === 'is_member' ? 'is_member' : 'director';
  return {
    ...rest,
    projectAssignment: {
      projectId: pm.project.id,
      projectName: pm.project.name,
      pjRole: pj,
    },
  };
};
