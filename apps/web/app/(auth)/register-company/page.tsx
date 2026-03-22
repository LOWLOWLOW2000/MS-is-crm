'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { registerCompany } from '@/lib/auth-api'

/**
 * 初回：企業テナント作成＋企業管理者＋ディレクター（メール＋任意パスワード）
 */
export default function RegisterCompanyPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [headOfficeAddress, setHeadOfficeAddress] = useState('')
  const [headOfficePhone, setHeadOfficePhone] = useState('')
  const [representativeName, setRepresentativeName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await registerCompany({
        email: email.trim(),
        password: password.trim() || undefined,
        name: name.trim(),
        companyName: companyName.trim(),
        headOfficeAddress: headOfficeAddress.trim(),
        headOfficePhone: headOfficePhone.trim(),
        representativeName: representativeName.trim(),
      })
      if (password.trim().length >= 8) {
        const r = await signIn('credentials', {
          email: email.trim(),
          password,
          redirect: false,
        })
        if (r?.error) {
          setError('登録は完了しましたがログインに失敗しました。ログイン画面から入ってください。')
          setLoading(false)
          return
        }
        window.location.href = '/dashboard'
        return
      }
      setError(null)
      window.location.href = '/login?registered=1'
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-gray-900">企業アカウント登録</h1>
        <p className="mb-6 text-sm text-gray-500">
          企業プロフィールを登録し、最初のユーザーに <strong>企業管理者＋ディレクター</strong> を付与します。パスワードは任意です（未設定の場合はログイン画面で OAuth を利用）。
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">メールアドレス（ID）</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">パスワード（任意・8文字以上）</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">氏名</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">企業名</label>
            <input
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">本社住所</label>
            <input
              required
              value={headOfficeAddress}
              onChange={(e) => setHeadOfficeAddress(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">本社電話</label>
            <input
              required
              value={headOfficePhone}
              onChange={(e) => setHeadOfficePhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">代表者氏名</label>
            <input
              required
              value={representativeName}
              onChange={(e) => setRepresentativeName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '登録中…' : '企業を作成'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-500">
          <Link href="/login" className="text-blue-600 hover:underline">
            ログインへ戻る
          </Link>
        </p>
      </div>
    </div>
  )
}
