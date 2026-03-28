import { UnderConstructionOverlay } from '@/components/UnderConstructionOverlay'
import { DashboardMenuLinks } from './_components/DashboardMenuLinks'

/**
 * ダッシュボード Overview。左ナビと同じエントリをカードで一覧し、遷移の起点にする。
 */
export default function DashboardPage() {
  return (
    <UnderConstructionOverlay ariaLabel="Overviewは準備中です" markSize="compact">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="space-y-1">
          <nav className="text-xs text-zinc-500" aria-label="パンくず">
            <span className="font-medium text-zinc-700">ダッシュボード</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Overview</h1>
          <p className="text-sm text-zinc-500">
            左メニューと同じページへ移動できます。ロールに応じて利用できる項目が異なります。
          </p>
        </header>
        <DashboardMenuLinks />
      </div>
    </UnderConstructionOverlay>
  )
}
