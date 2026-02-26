import Link from 'next/link';

const HomePage = () => {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">IS架電管理CRM</h1>
      <p className="text-center text-gray-600">
        Phase 1 雛形。認証はメール/パスワードとGoogle SSOに対応しています。
      </p>
      <div className="flex gap-4">
        <Link href="/login" className="rounded bg-blue-600 px-4 py-2 text-white">
          ログインへ
        </Link>
        <Link href="/dashboard" className="rounded border border-gray-300 px-4 py-2">
          ダッシュボードへ
        </Link>
      </div>
    </main>
  );
};

export default HomePage;
