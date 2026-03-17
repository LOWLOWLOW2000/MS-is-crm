/**
 * 未調査リスト精査。モック inside-sales-refinement.html 準拠。左: 承認ボタン・未承認ステータス、右: HP・INFO・検索窓。
 */
export default function RefinementPage() {
  return (
    <div className="flex gap-4">
      <aside className="w-72 shrink-0 space-y-4">
        <span className="inline-block rounded-md bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-800">
          IS UI 未調査リスト精査モード
        </span>
        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">承認ボタン...</h2>
          <div className="mt-3 flex gap-2">
            <button type="button" className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
              一括承認
            </button>
            <button type="button" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
              却下
            </button>
          </div>
        </section>
        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">未承認リストステータス</h2>
          <p className="mt-2 text-xs text-gray-500">未承認のリストを表示</p>
          <ul className="mt-3 list-none text-sm text-gray-500">
            <li>・待機中 3件</li>
            <li>・確認中 1件</li>
          </ul>
        </section>
      </aside>
      <div className="flex-1 rounded-md border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">HP・INFO・検索窓</h2>
        <p className="mt-1 text-xs text-gray-500">企業HP、情報、検索</p>
        <input
          type="search"
          placeholder="企業名・URL・メモで検索"
          className="mt-4 w-full max-w-md rounded-md border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="mt-6 flex h-48 items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
          HP・INFO 表示エリア
        </div>
      </div>
    </div>
  )
}
