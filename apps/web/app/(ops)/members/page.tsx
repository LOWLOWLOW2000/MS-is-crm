'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { fetchUsers, type UserListItem } from '@/lib/calling-api'

/**
 * 運営: メンバー・ロール管理（テナント内ユーザー一覧）。
 * GET /users で取得しテーブル表示。developer / is_admin / enterprise_admin / director が利用想定。
 */
export default function OpsMembersPage() {
  const { data: session, status } = useSession()
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) {
      setLoading(status === 'loading')
      if (status === 'unauthenticated') setLoading(false)
      return
    }
    let cancelled = false
    setError(null)
    setLoading(true)
    fetchUsers(session.accessToken)
      .then((data) => {
        if (!cancelled) setUsers(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'ユーザー一覧の取得に失敗しました')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session?.accessToken, status])

  if (status === 'loading' || loading) {
    return (
      <div>
        <h1 className="text-xl font-bold text-gray-900">メンバー・ロール管理</h1>
        <p className="mt-2 text-gray-600">ユーザー一覧・ロール・有効/無効・チーム紐付け（将来拡張）</p>
        <div className="mt-6 rounded border border-gray-200 bg-white p-8 text-center text-gray-500">
          読み込み中…
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div>
        <h1 className="text-xl font-bold text-gray-900">メンバー・ロール管理</h1>
        <p className="mt-2 text-gray-600">ログインしてください。</p>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-bold text-gray-900">メンバー・ロール管理</h1>
        <p className="mt-2 text-gray-600">ユーザー一覧・ロール・有効/無効・チーム紐付け（将来拡張）</p>
        <div className="mt-6 rounded border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">メンバー・ロール管理</h1>
      <p className="mt-2 text-gray-600">ユーザー一覧・ロール・有効/無効・チーム紐付け（将来拡張）</p>
      <div className="mt-6 overflow-hidden rounded border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">ID</th>
                <th className="px-4 py-3 font-medium text-gray-700">名前</th>
                <th className="px-4 py-3 font-medium text-gray-700">メール</th>
                <th className="px-4 py-3 font-medium text-gray-700">ロール</th>
                <th className="px-4 py-3 font-medium text-gray-700">登録日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    ユーザーがありません
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-gray-600">{u.id}</td>
                    <td className="px-4 py-2 text-gray-900">{u.name}</td>
                    <td className="px-4 py-2 text-gray-700">{u.email}</td>
                    <td className="px-4 py-2 text-gray-700">{u.role}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('ja-JP') : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
