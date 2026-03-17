/**
 * 管理レイヤ。左ナビ「管理レイヤ」のメイン。1カラム。
 */
export default function AdminPage() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">管理レイヤ</h1>
      <p className="mt-2 text-sm text-gray-600">
        ディレクター・管理者向けの設定・権限・組織管理です。
      </p>
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-label="管理レイヤメイン">
        <h2 className="text-base font-semibold text-gray-900">管理メニュー</h2>
        <p className="mt-2 text-sm text-gray-500">
          組織・権限・設定・監査ログなど。管理レイヤ用の機能をここに表示します。（モック）
        </p>
        <div className="mt-4 min-h-[200px] rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-400">
          管理レイヤ設定・一覧エリア
        </div>
      </section>
    </div>
  )
}
