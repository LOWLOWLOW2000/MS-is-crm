import Link from 'next/link'

/**
 * ディレクター（プロジェクト）。左ナビ「ディレクター」のメイン。1カラム。
 */
export default function DirectorPage() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">ディレクター</h1>
      <p className="mt-2 text-sm text-gray-600">
        ディレクター・企業アカウント専用。プロジェクトKPI・AIレポート・日報BOXへ。
      </p>
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-label="ディレクターメイン">
        <h2 className="text-base font-semibold text-gray-900">メニュー</h2>
        <ul className="mt-4 space-y-2">
          <li>
            <Link href="/director/kpi" className="block rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-100">
              プロジェクトKPI
            </Link>
          </li>
          <li>
            <Link href="/director/ai-report" className="block rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-100">
              AIレポート
            </Link>
          </li>
          <li>
            <Link href="/director/daily-box" className="block rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-100">
              日報BOX
            </Link>
          </li>
        </ul>
      </section>
    </div>
  )
}
