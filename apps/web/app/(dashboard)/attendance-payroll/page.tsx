/**
 * 出勤管理表＆報酬計算。左ナビ「出勤管理表＆報酬計算」のメイン。1カラム。
 */
export default function AttendancePayrollPage() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">出勤管理表＆報酬計算</h1>
      <p className="mt-2 text-sm text-gray-600">
        出勤管理表の確認・承認と報酬計算を行います。
      </p>
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-label="出勤管理メイン">
        <h2 className="text-base font-semibold text-gray-900">出勤管理表</h2>
        <p className="mt-2 text-sm text-gray-500">
          日別・メンバー別の出勤状況。承認フロー。（モック）
        </p>
        <div className="mt-4 min-h-[120px] rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-400">
          出勤管理表エリア
        </div>
      </section>
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-label="報酬計算">
        <h2 className="text-base font-semibold text-gray-900">報酬計算</h2>
        <p className="mt-2 text-sm text-gray-500">
          勤務時間・単価に基づく報酬計算。明細・集計。（モック）
        </p>
        <div className="mt-4 min-h-[120px] rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-400">
          報酬計算エリア
        </div>
      </section>
    </div>
  )
}
