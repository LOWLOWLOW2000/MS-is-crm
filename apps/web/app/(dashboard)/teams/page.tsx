/**
 * Teams表。左ナビ「Teams表」のメイン。1カラム。
 */
export default function TeamsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">Teams表</h1>
      <p className="mt-2 text-sm text-gray-600">
        チーム一覧・メンバー構成・担当PJを表形式で管理します。
      </p>
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-label="Teams表メイン">
        <h2 className="text-base font-semibold text-gray-900">チーム一覧</h2>
        <p className="mt-2 text-sm text-gray-500">
          チーム名・リーダー・メンバー・担当PJを表で表示。検索・フィルタ対応。（モック）
        </p>
        <div className="mt-4 min-h-[200px] rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-400">
          Teams表エリア
        </div>
      </section>
    </div>
  )
}
