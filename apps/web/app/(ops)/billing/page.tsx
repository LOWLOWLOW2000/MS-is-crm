export default function OpsBillingPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">課金リミッター / 課金plan調整</h1>
      <p className="mt-2 text-gray-600">課金上限・プランの変更を行います。</p>
      <div className="mt-8 space-y-6">
        <section className="rounded border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-700">課金リミット</h2>
          <p className="mt-2 text-sm text-gray-500">利用上限の設定（将来実装）</p>
        </section>
        <section className="rounded border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-700">課金プラン調整</h2>
          <p className="mt-2 text-sm text-gray-500">プラン変更・有効/無効（将来実装）</p>
        </section>
      </div>
    </div>
  );
}
