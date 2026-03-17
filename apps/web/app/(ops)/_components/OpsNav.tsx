'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { label: '運営トップ', href: '/ops' },
  { label: '課金リミッター・課金plan調整', href: '/ops/billing' },
  { label: 'リスト・案件管理', href: '/ops/lists' },
  { label: 'メンバー・ロール管理', href: '/ops/members' },
  { label: 'KPI・レポート（運営視点）', href: '/ops/reports' },
  { label: 'スクリプト・テンプレ管理', href: '/ops/scripts' },
  { label: '設定・連携', href: '/ops/settings' },
  { label: 'ログ・監査', href: '/ops/audit' },
];

export function OpsNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-gray-200 bg-white p-3">
      <span className="px-3 py-2 text-xs font-semibold text-gray-400">バックヤード</span>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`rounded px-3 py-2 text-sm ${
            pathname === item.href ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
