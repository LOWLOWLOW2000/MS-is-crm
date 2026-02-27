'use client';

import type { UserRole } from '@/lib/types';
import { getRoleTheme } from '@/lib/role-theme';

type RoleBadgeProps = {
  role: UserRole;
  name?: string;
};

export const RoleBadge = ({ role, name }: RoleBadgeProps) => {
  const theme = getRoleTheme(role);

  return (
    <div className="space-y-1">
      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-xs">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${theme.badgeClass}`}>
          {theme.label}
        </span>
        {name ? <span className="text-slate-600">{name}</span> : null}
      </div>
      <p className="text-xs text-slate-500">{theme.subtitle}</p>
    </div>
  );
};

