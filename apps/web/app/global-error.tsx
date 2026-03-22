'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', padding: 24, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>重大なエラーが発生しました</h2>
        <p style={{ fontSize: 14, color: '#4b5563', marginTop: 8 }}>ページを再読み込みするか、トップからやり直してください。</p>
        {process.env.NODE_ENV === 'development' && (
          <pre style={{ marginTop: 12, maxHeight: 120, overflow: 'auto', fontSize: 12, color: '#991b1b', textAlign: 'left', width: '100%', maxWidth: 480 }}>
            {error.message}
          </pre>
        )}
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
