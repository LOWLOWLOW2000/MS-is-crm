/**
 * プロジェクトKPI（KPI APIレポート）。左ナビ「プロジェクトKPI」のメイン。1カラム。
 */
export default function DirectorKpiPage() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">プロジェクトKPI</h1>
      <p className="mt-2 text-sm text-gray-600">
        プロジェクト（案件）単位のKPI。PJ別・期間別のテーブル・APIレポート。
      </p>
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-label="プロジェクトKPIメイン">
        <h2 className="text-base font-semibold text-gray-900">KPI一覧</h2>
        <p className="mt-2 text-sm text-gray-500">
          PJ別・期間別のKPIテーブルをここに表示。API連携時はKPI APIレポートを取得します。（モック）
        </p>
        <div className="mt-4 min-h-[200px] rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-400">
          PJ別・期間別 KPIテーブル / APIレポートエリア
        </div>
      </section>
    </div>
  )
}
