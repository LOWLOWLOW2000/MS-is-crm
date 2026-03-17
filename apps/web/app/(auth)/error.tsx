'use client';

import { useEffect } from 'react';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-semibold">ログイン画面で問題が発生しました</h2>
      <p className="text-sm text-gray-600">しばらくしてから再度お試しください。</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          再試行
        </button>
        <a href="/login" className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
          ログインへ
        </a>
        <a href="/" className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
          トップへ
        </a>
      </div>
    </div>
  );
}
