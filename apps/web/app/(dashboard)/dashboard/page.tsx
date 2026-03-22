import Link from 'next/link'

/**
 * ダッシュボード（モック dashboard.html 準拠）。ロールに応じたリンクを2セクションで表示。
 */
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">ダッシュボード</h1>
      <p className="mt-2 text-sm text-gray-500">ロールに応じたページへ移動してください。（ページ移管モック）</p>
      <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-2 min-[900px]:grid-cols-[repeat(2,minmax(280px,1fr))]">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-500">共通・IS</h2>
          <ul className="list-none space-y-1">
            <li>
              <Link href="/kpi" className="text-blue-600 no-underline hover:underline">KPIページ</Link>
            </li>
            <li>
              <Link href="/ai-daily" className="text-blue-600 no-underline hover:underline">AI日報</Link>
            </li>
            <li>
              <Link href="/sales-room" className="text-blue-600 no-underline hover:underline">インサイドセールス（IS UI）</Link>
            </li>
            <li>
              <Link href="/sales-room/refinement" className="text-blue-600 no-underline hover:underline">未調査リスト精査</Link>
            </li>
            <li>
              <Link href="/corporate" className="text-blue-600 no-underline hover:underline">企業管理者</Link>
            </li>
          </ul>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-500">ディレクター・企業アカウント専用</h2>
          <ul className="list-none space-y-1">
            <li>
              <Link href="/director" className="text-blue-600 no-underline hover:underline">ディレクター</Link>
            </li>
            <li>
              <Link href="/director/kpi" className="text-blue-600 no-underline hover:underline">プロジェクトKPI</Link>
            </li>
            <li>
              <Link href="/director/ai-report" className="text-blue-600 no-underline hover:underline">AIレポート</Link>
            </li>
            <li>
              <Link href="/director/daily-box" className="text-blue-600 no-underline hover:underline">日報BOX</Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
