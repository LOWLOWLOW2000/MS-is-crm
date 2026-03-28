'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useState } from 'react'
import { fetchMyProfile, type MyProfile } from '@/lib/calling-api'

const pjRoleLabel = (pj: 'director' | 'is_member'): string =>
  pj === 'director' ? 'ディレクター（PJ）' : 'ISメンバー（PJ）'

/**
 * PJ変更：アサイン済み案件をパネル表示し、架電ルームへ遷移する。
 * テナント既定PJは1件のため、現状は最大1パネル（将来 multi-PJ 時は配列をそのまま拡張可）。
 */
export default function PjSwitchPage() {
  const { data: session, status } = useSession()
  const accessToken = session?.accessToken ?? ''
  const [profile, setProfile] = useState<MyProfile | null>(null)
  const [error, setError] = useState<string>('')

  const load = useCallback(async () => {
    if (!accessToken) return
    setError('')
    try {
      const me = await fetchMyProfile(accessToken)
      setProfile(me)
    } catch (e) {
      setProfile(null)
      setError(e instanceof Error ? e.message : 'プロフィールの取得に失敗しました')
    }
  }, [accessToken])

  useEffect(() => {
    void load()
  }, [load])

  const hasAssignment = Boolean(profile?.projectAssignment)

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">PJ変更</h1>
      <p className="mt-2 text-sm text-gray-600">
        今アサインされている案件の看板から、案件の架電ルームへ移動できます。
      </p>

      {status === 'loading' ? (
        <div className="mt-8 h-32 animate-pulse rounded-xl bg-gray-100" aria-hidden />
      ) : status === 'unauthenticated' ? (
        <p className="mt-6 text-sm text-amber-800">
          <Link href="/login" className="font-semibold text-blue-600 hover:underline">
            ログイン
          </Link>
          が必要です。
        </p>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      {profile ? (
        <ul className="mt-6 grid list-none gap-4 sm:grid-cols-1 md:grid-cols-2">
          {hasAssignment ? (
            <li>
              <article className="flex h-full flex-col rounded-xl border border-blue-200 bg-gradient-to-b from-blue-50/90 to-white p-5 shadow-sm ring-1 ring-blue-100">
                <div className="flex justify-start">
                  <Link
                    href="/sales-room/v2"
                    className="inline-flex shrink-0 items-center justify-center rounded-lg border border-blue-400 bg-white px-3 py-2 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-50"
                  >
                    案件の架電ルームへ移動
                  </Link>
                </div>
                <h2 className="mt-3 text-base font-bold text-gray-900">
                  {profile.projectAssignment?.projectName ?? profile.tenantProjectName}
                </h2>
                <p className="mt-1 text-xs font-medium text-blue-800">
                  {profile.projectAssignment
                    ? pjRoleLabel(profile.projectAssignment.pjRole)
                    : ''}
                </p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-700">
                  所属: {profile.tenantCompanyName}
                  <br />
                  テナント表示PJ名: {profile.tenantProjectName}
                  <br />
                  このPJに配役されています。リスト・架電・KPIはテナント内で共有され、業務はこのコンテキストで行います。
                </p>
              </article>
            </li>
          ) : (
            <li className="md:col-span-2">
              <article className="rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50/90 to-white px-6 py-10 text-center shadow-sm ring-1 ring-amber-100">
                <p className="text-xl font-bold leading-snug text-amber-950 sm:text-2xl">
                  管理者かディレクターに招待をリクエストして下さい
                </p>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  所属: {profile.tenantCompanyName}
                  <br />
                  テナント表示PJ名: {profile.tenantProjectName}
                  <br />
                  PJにアサインされると、ここから架電ルームへ進めます。
                </p>
                {profile.roles.some((r) => r === 'enterprise_admin' || r === 'director') ? (
                  <Link
                    href="/admin"
                    className="mt-6 inline-block rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                  >
                    メンバー招待・PJアサイン（管理）へ
                  </Link>
                ) : null}
              </article>
            </li>
          )}
        </ul>
      ) : null}
    </div>
  )
}
