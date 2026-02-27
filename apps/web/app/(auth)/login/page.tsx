'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import type { UserRole } from '@/lib/types';

const getPostLoginPath = (role: UserRole | undefined): string => {
  if (role === 'is_member') {
    return '/calling';
  }

  return '/dashboard';
};

/** 開発用プリセット（開発中のみ使用） */
const DEV_PRESETS = [
  { label: 'IS', email: 'member@example.com', password: 'ChangeMe123!' },
  { label: 'ディレクター', email: 'director@example.com', password: 'ChangeMe123!' },
  { label: '会社ID', email: 'company@example.com', password: 'ChangeMe123!' },
] as const;

const LoginPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('developer@example.com');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState('');

  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(getPostLoginPath(session?.user?.role));
    }
  }, [status, session, router]);

  const handleCredentialsLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.ok) {
      const nextPath = email === 'member@example.com' ? '/calling' : '/dashboard';
      router.replace(nextPath);
      return;
    }

    setError('ログインに失敗しました。入力内容を確認してください。');
  };

  const handleDevPreset = async (preset: (typeof DEV_PRESETS)[number]) => {
    setError('');
    setEmail(preset.email);
    setPassword(preset.password);

    const result = await signIn('credentials', {
      email: preset.email,
      password: preset.password,
      redirect: false,
    });

    if (result?.ok) {
      const nextPath =
        preset.email === 'member@example.com' ? '/calling' : '/dashboard';
      router.replace(nextPath);
      return;
    }

    setError(`${preset.label}でログインに失敗しました。`);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">ログイン</h1>

      {isDev && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-xs font-medium text-amber-800">開発用（開発中のみ表示）</p>
          <div className="flex flex-wrap gap-2">
            {DEV_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleDevPreset(preset)}
                className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700"
              >
                {preset.label}で入る
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleCredentialsLogin} className="space-y-4 rounded border border-gray-200 p-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            required
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button type="submit" className="w-full rounded bg-blue-600 px-4 py-2 text-white">
          メールでログイン
        </button>
      </form>

      <button
        type="button"
        onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
        className="rounded border border-gray-300 px-4 py-2"
      >
        Googleでログイン
      </button>
    </main>
  );
};

export default LoginPage;
