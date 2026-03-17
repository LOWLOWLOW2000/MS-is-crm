'use client';

import { useEffect } from 'react';

export default function GlobalError({
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
    <html lang="ja">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', padding: 24, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>重大なエラーが発生しました</h2>
        <p style={{ fontSize: 14, color: '#4b5563', marginTop: 8 }}>ページを再読み込みするか、トップからやり直してください。</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button
            type="button"
            onClick={reset}
            style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            再試行
          </button>
          <a href="/" style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', textDecoration: 'none' }}>
            トップへ
          </a>
        </div>
      </body>
    </html>
  );
}
