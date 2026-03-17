/**
 * 日報BOX。左ナビ「日報BOX」のメイン。1カラム。
 */
export default function DirectorDailyBoxPage() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">日報BOX</h1>
      <p className="mt-2 text-sm text-gray-600">
        各案件の日報一覧。未読数表示・詳細からチャットで返信できます。
      </p>
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-label="日報BOXメイン">
        <h2 className="text-base font-semibold text-gray-900">日報一覧</h2>
        <p className="mt-2 text-sm text-gray-500">
          未読数バッジ付き日報一覧・詳細・チャットUIをここに表示。（モック）
        </p>
        <div className="mt-4 min-h-[200px] rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-400">
          日報一覧・詳細・チャット返信エリア
        </div>
      </section>
    </div>
  )
}
