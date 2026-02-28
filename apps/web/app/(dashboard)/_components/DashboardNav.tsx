'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'KPIダッシュボード', href: '/dashboard/kpi' },
  {
    label: '日報管理',
    children: [
      { label: 'AI日報生成', href: '/dashboard/daily-reports' },
      { label: '日報作成・添削・提出', href: '/dashboard/daily-reports/new' },
      { label: '過去ログ検索（アーカイブ）', href: '/dashboard/daily-reports/archive' },
    ],
  },
  { label: '外部連携設定', href: '/dashboard/integrations' },
];

const existingItems = [
  { label: '架電', href: '/calling' },
  { label: 'リスト', href: '/lists' },
  { label: '再架電', href: '/recall' },
  { label: 'スクリプト', href: '/scripts' },
  { label: 'レポート', href: '/reports' },
  { label: '設定', href: '/settings' },
  { label: 'ディレクター', href: '/director' },
  { label: 'ダッシュボード', href: '/dashboard' },
];

const isActive = (pathname: string, href: string): boolean => {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(href + '/');
};

export const DashboardNav = () => {
  const pathname = usePathname() ?? '';

  return (
    <nav className="flex w-52 shrink-0 flex-col border-r border-slate-200 bg-white py-3 text-sm">
      <div className="px-3 py-1">
        <span className="font-semibold text-slate-800">架電PJ</span>
      </div>
      <ul className="mt-2 space-y-0.5 px-2">
        {navItems.map((item) => {
          if ('children' in item) {
            return (
              <li key={item.label}>
                <span className="block px-2 py-1.5 font-medium text-slate-500">
                  {item.label}
                </span>
                <ul className="ml-2 space-y-0.5 border-l border-slate-200 pl-2">
                  {item.children.map((child) => (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        className={`block rounded px-2 py-1.5 ${
                          isActive(pathname, child.href)
                            ? 'bg-slate-100 font-medium text-blue-700'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          }
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded px-2 py-1.5 ${
                  isActive(pathname, item.href)
                    ? 'bg-slate-100 font-medium text-blue-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="my-2 border-t border-slate-200 pt-2" />
        {existingItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`block rounded px-2 py-1.5 ${
                isActive(pathname, item.href)
                  ? 'bg-slate-100 font-medium text-blue-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};
