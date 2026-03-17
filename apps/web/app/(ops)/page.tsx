export default function OpsDashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">運営トップ</h1>
      <p className="mt-2 text-gray-600">全体の健康状態と今日見るべき項目を把握します。</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <section className="rounded border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700">今日の架電・接続率・アポ</h3>
          <p className="mt-2 text-xs text-gray-500">（数値はAPI連携後に表示）</p>
        </section>
        <section className="rounded border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700">リスト消化状況</h3>
          <p className="mt-2 text-xs text-gray-500">残件・枯渇リスク</p>
        </section>
        <section className="rounded border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700">再架電の滞留</h3>
          <p className="mt-2 text-xs text-gray-500">期限超過件数</p>
        </section>
        <section className="rounded border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700">アラート</h3>
          <p className="mt-2 text-xs text-gray-500">API停止・連携失敗・重大エラー</p>
        </section>
      </div>
    </div>
  );
}
