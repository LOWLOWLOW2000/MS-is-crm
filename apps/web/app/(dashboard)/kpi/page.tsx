/**
 * KPIページ（AI）。左ナビ「KPIページ（AI）」のメイン。子要素は1カラムで縦並び。
 */
export default function KpiPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6">
      <header className="shrink-0">
        <h1 className="text-xl font-bold text-gray-900">KPIページ（AI）</h1>
        <p className="mt-2 text-sm text-gray-600">
          個人・チーム・PJのKPIをAI診断で可視化します。
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-6">
        <section
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          aria-label="スコープ選択"
        >
          <h2 className="text-base font-semibold text-gray-900">表示スコープ</h2>
          <p className="mt-1 text-sm text-gray-500">全体・Team・個人の切り替え</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">
              全体
            </span>
            <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">
              Team
            </span>
            <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">
              個人
            </span>
          </div>
        </section>

        <section
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          aria-label="KPIグラフ"
        >
          <h2 className="text-base font-semibold text-gray-900">KPI（個人・チーム・PJ）</h2>
          <p className="mt-1 text-sm text-gray-500">
            達成率・件数・推移をグラフ表示。（モック）
          </p>
          <div className="mt-4 min-h-[180px] rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-400">
            KPIグラフエリア
          </div>
        </section>

        <section
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          aria-label="AI診断"
        >
          <h2 className="text-base font-semibold text-gray-900">AI診断</h2>
          <p className="mt-1 text-sm text-gray-500">
            KPIに基づくAI診断コメントをここに表示します。（モック）
          </p>
          <div className="mt-4 min-h-[100px] rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-400">
            AI診断コメントエリア
          </div>
        </section>
      </div>
    </div>
  )
}
