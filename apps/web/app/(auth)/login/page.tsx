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

const LoginPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('developer@example.com');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState('');

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
      router.replace('/login');
      return;
    }

    setError('ログインに失敗しました。入力内容を確認してください。');
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">ログイン</h1>

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
        onClick={() => signIn('google', { callbackUrl: '/login' })}
        className="rounded border border-gray-300 px-4 py-2"
      >
        Googleでログイン
      </button>
    </main>
  );
};

export default LoginPage;
