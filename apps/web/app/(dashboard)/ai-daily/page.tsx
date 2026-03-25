/**
 * 日報（AI）。左ナビ「日報（AI）」のメイン。1カラム。
 */
export default function AiDailyPage() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">日報（AI）</h1>
      <p className="mt-2 text-sm text-gray-600">
        PJを選びAIが日報を生成。投函後はスレッドでディレクターと返信できます。
      </p>
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-label="日報AIメイン">
        <h2 className="text-base font-semibold text-gray-900">日報の生成・投函</h2>
        <p className="mt-2 text-sm text-gray-500">
          PJ選択 → 生成 → 確認・編集 → 投函。一覧からスレッドで返信。（モック）
        </p>
        <div className="mt-4 min-h-[200px] rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-400">
          PJ選択・日報生成・投函・スレッド一覧エリア
        </div>
      </section>
    </div>
  )
}
