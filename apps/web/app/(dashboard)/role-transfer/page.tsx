import Link from 'next/link'

/**
 * 権限委任ページ（ダッシュボード内）。
 * 権限の委任・移任に関連する内部リンクを表示。実装は今後。
 */
export default function RoleTransferPage() {
  const internalLinks = [
    { href: '/dashboard', label: 'メニュー', description: 'ダッシュボードハブ' },
    { href: '/dashboard/calendar', label: 'カレンダー', description: '予定・稼働・外部カレンダー連携' },
    { href: '/ops/members', label: 'メンバー・ロール管理', description: 'ユーザー一覧・ロール・有効/無効' },
    { href: '/dashboard/corporate', label: '個人アカウント', description: '個人設定・アカウント' },
  ] as const

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">権限委任</h1>
      <p className="mt-2 text-sm text-gray-600">
        権限の委任・移任を行うページです。関連する画面へは以下のリンクから移動できます。
      </p>
      <ul className="mt-6 space-y-4" role="list">
        {internalLinks.map(({ href, label, description }) => (
          <li key={href}>
            <Link
              href={href}
              className="block rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/50"
            >
              <span className="font-medium text-gray-900">{label}</span>
              <span className="ml-2 text-sm text-gray-500">— {description}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-gray-500">（委任・移任の操作UIは今後実装）</p>
    </div>
  )
}
