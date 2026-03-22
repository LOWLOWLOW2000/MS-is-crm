'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { acceptInvitation, validateInvitation } from '@/lib/auth-api'
import type { UserRole } from '@/lib/types'

function InviteAcceptInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<{
    tenantName: string
    email: string
    roles: UserRole[]
    expiresAt: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('招待トークンがありません')
      setLoading(false)
      return
    }
    void (async () => {
      try {
        const v = await validateInvitation(token)
        setMeta({
          tenantName: v.tenantName,
          email: v.email,
          roles: v.roles,
          expiresAt: v.expiresAt,
        })
      } catch {
        setError('招待が無効か期限切れです')
      }
      setLoading(false)
    })()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !meta) return
    setError(null)
    setSubmitting(true)
    try {
      await acceptInvitation({
        token,
        password: password.trim() || undefined,
        name: name.trim() || undefined,
      })
      const r = await signIn('credentials', {
        email: meta.email,
        password,
        redirect: false,
      })
      if (r?.error) {
        setError('参加登録は完了しました。ログイン画面から同じメール・パスワードで入ってください。')
        setSubmitting(false)
        return
      }
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : '参加に失敗しました')
    }
    setSubmitting(false)
  }

  if (loading) {
    return <p className="p-8 text-center text-sm text-gray-600">確認中…</p>
  }

  if (error && !meta) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/login" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          ログインへ
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-gray-900">招待の承諾</h1>
        {meta && (
          <p className="mb-4 text-sm text-gray-600">
            <span className="font-medium">{meta.tenantName}</span> への招待です。メール: {meta.email}
            <br />
            ロール: {meta.roles.join(', ')}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">表示名（任意）</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">パスワード（8文字以上・必須）</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              autoComplete="new-password"
            />
          </div>
          {error && (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? '処理中…' : '参加を完了'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-500">
          <Link href="/login" className="text-blue-600 hover:underline">
            ログインへ
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm">読み込み中…</p>}>
      <InviteAcceptInner />
    </Suspense>
  )
}
