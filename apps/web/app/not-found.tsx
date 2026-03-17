import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-semibold">ページが見つかりません</h2>
      <p className="text-sm text-gray-600">指定されたURLは存在しません。</p>
      <div className="flex gap-3">
        <Link href="/dashboard" className="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-700">
          メニューへ
        </Link>
        <Link href="/" className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
          トップへ
        </Link>
      </div>
    </div>
  );
}
