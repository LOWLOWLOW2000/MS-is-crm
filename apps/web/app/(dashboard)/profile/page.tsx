'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatHeaderRolesJa } from '@/lib/role-labels'
import type { UserRole } from '@/lib/types'

/**
 * 全ティア共通のプロフィール設定。表示はセッション由来、保存はモック（API 未接続）。
 */
export default function ProfileSettingsPage() {
  const { data: session, status } = useSession()
  const [displayName, setDisplayName] = useState('')
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [notifyDailyDigest, setNotifyDailyDigest] = useState(false)
  const [mockSaved, setMockSaved] = useState(false)

  useEffect(() => {
    if (session?.user?.name) setDisplayName(session.user.name)
  }, [session?.user?.name])

  if (status === 'loading') {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded-md bg-gray-200" />
        <div className="mt-4 h-32 animate-pulse rounded-xl bg-gray-100" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <h1 className="text-xl font-bold text-gray-900">プロフィール設定</h1>
        <p className="mt-2 text-sm text-gray-600">設定を表示するにはログインしてください。</p>
        <Link
          href="/login"
          className="mt-4 inline-flex rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ログインへ
        </Link>
      </div>
    )
  }

  const u = session.user
  const rolesJa = formatHeaderRolesJa((u.roles ?? [u.role]) as UserRole[])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6">
      <header className="shrink-0">
        <h1 className="text-xl font-bold text-gray-900">プロフィール設定</h1>
        <p className="mt-2 text-sm text-gray-600">
          全ティアで共通の表示名・通知の目安です。所属・役職は管理者設定に従います。
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-6">
        <section
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          aria-label="アカウント情報"
        >
          <h2 className="text-base font-semibold text-gray-900">アカウント</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-1">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">表示名</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  setMockSaved(false)
                }}
                className="mt-1 w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoComplete="name"
              />
              <span className="mt-1 block text-xs text-gray-500">
                画面上の「自分名」などに使われます（保存はバックエンド接続後に有効化予定）。
              </span>
            </label>
            <div>
              <span className="text-sm font-medium text-gray-700">メールアドレス</span>
              <p className="mt-1 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                {u.email || '未設定'}
              </p>
              <span className="mt-1 block text-xs text-gray-500">ログイン ID のため変更は管理者依頼となります。</span>
            </div>
          </div>
        </section>

        <section
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          aria-label="所属と役職"
        >
          <h2 className="text-base font-semibold text-gray-900">所属・役職（参照のみ）</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-28 shrink-0 font-medium text-gray-500">所属企業</dt>
              <dd className="text-gray-900">{u.tenantCompanyName || '未設定'}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-28 shrink-0 font-medium text-gray-500">PJ 名</dt>
              <dd className="text-gray-900">{u.tenantProjectName || '未設定'}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-28 shrink-0 font-medium text-gray-500">役職</dt>
              <dd className="text-gray-900">{rolesJa}</dd>
            </div>
          </dl>
        </section>

        <section
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          aria-label="通知設定"
        >
          <h2 className="text-base font-semibold text-gray-900">通知（モック）</h2>
          <p className="mt-1 text-sm text-gray-500">実装時にメール・Teams 連携と紐づけます。</p>
          <ul className="mt-4 space-y-3">
            <li className="flex items-start gap-3">
              <input
                id="notify-email"
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => {
                  setNotifyEmail(e.target.checked)
                  setMockSaved(false)
                }}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="notify-email" className="text-sm text-gray-800">
                重要なお知らせをメールで受け取る
              </label>
            </li>
            <li className="flex items-start gap-3">
              <input
                id="notify-digest"
                type="checkbox"
                checked={notifyDailyDigest}
                onChange={(e) => {
                  setNotifyDailyDigest(e.target.checked)
                  setMockSaved(false)
                }}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="notify-digest" className="text-sm text-gray-800">
                日次ダイジェスト（KPI・日報サマリー）
              </label>
            </li>
          </ul>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setMockSaved(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            保存（モック）
          </button>
          {mockSaved ? (
            <span className="text-sm text-green-700" role="status">
              保存しました（UI のみ。API 未接続）
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
