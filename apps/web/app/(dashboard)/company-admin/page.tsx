'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { fetchTenantProfile, fetchUsers, updateTenantProfile, type UserListItem } from '@/lib/calling-api'
import type { TenantProfile, UpdateTenantBody } from '@/lib/types'
import { RoleTierPanel } from '@/components/RoleTierPanel'
import { effectiveRolesFromListItem } from '@/lib/member-display'
import type { UserRole } from '@/lib/types'

const hasEnterpriseAdmin = (roles: UserRole[]): boolean => roles.includes('enterprise_admin')

/**
 * 企業管理者: テナント登録情報の入力と AM（アカウントマネージャー）の割当。
 * `/corporate` は法人ツリー編集、当画面は「企業アカウント（Tenant）」メタデータ。
 */
export default function CompanyAdminPage() {
  const { data: session, status } = useSession()
  const accessToken = (session as unknown as { accessToken?: string } | null)?.accessToken ?? null
  const sessionRoles = useMemo((): UserRole[] => {
    const u = session?.user as { roles?: UserRole[]; role?: UserRole } | undefined
    if (u?.roles && u.roles.length > 0) return u.roles
    if (u?.role) return [u.role]
    return []
  }, [session?.user])

  const canEdit = hasEnterpriseAdmin(sessionRoles) || sessionRoles.includes('developer')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tenant, setTenant] = useState<TenantProfile | null>(null)
  const [members, setMembers] = useState<UserListItem[]>([])

  const [companyName, setCompanyName] = useState('')
  const [headOfficeAddress, setHeadOfficeAddress] = useState('')
  const [headOfficePhone, setHeadOfficePhone] = useState('')
  const [representativeName, setRepresentativeName] = useState('')
  const [projectDisplayName, setProjectDisplayName] = useState('')
  const [accountStatus, setAccountStatus] = useState('active')
  const [amIds, setAmIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const [t, users] = await Promise.all([fetchTenantProfile(accessToken), fetchUsers(accessToken)])
      setTenant(t)
      setCompanyName(t.companyName ?? '')
      setHeadOfficeAddress(t.headOfficeAddress ?? '')
      setHeadOfficePhone(t.headOfficePhone ?? '')
      setRepresentativeName(t.representativeName ?? '')
      setProjectDisplayName(t.projectDisplayName ?? '')
      setAccountStatus(t.accountStatus ?? 'active')
      setAmIds(new Set(t.accountManagerUserIds ?? []))
      setMembers(users)
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (status === 'loading') return
    if (!accessToken) {
      setLoading(false)
      return
    }
    void load()
  }, [accessToken, status, load])

  const toggleAm = (userId: string) => {
    setAmIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const onSaveProfile = async () => {
    if (!accessToken || !canEdit) return
    setSaving(true)
    setError(null)
    try {
      const body: UpdateTenantBody = {
        companyName: companyName.trim() || undefined,
        headOfficeAddress: headOfficeAddress.trim() || undefined,
        headOfficePhone: headOfficePhone.trim() || undefined,
        representativeName: representativeName.trim() || undefined,
        projectDisplayName: projectDisplayName.trim() || undefined,
        accountStatus: accountStatus.trim() || undefined,
        accountManagerUserIds: [...amIds],
      }
      const next = await updateTenantProfile(accessToken, body)
      setTenant(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="p-6 text-sm text-gray-500" role="status">
        読み込み中…
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">ログインが必要です。</p>
        <Link href="/login" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
          ログインへ
        </Link>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-medium">企業管理者のみがアクセスできます。</p>
          <p className="mt-2 text-xs text-amber-900/90">
            テナントの登録情報や AM の割当は、enterprise_admin ロールが必要です。
          </p>
          <Link href="/dashboard" className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline">
            Overview へ戻る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-bold text-gray-900">企業管理</h1>
        <p className="mt-1 text-sm text-gray-600">
          企業アカウント作成時に埋める登録情報と、AM（アカウントマネージャー）の割当。
        </p>
        <p className="mt-2 text-xs text-gray-500">
          法人・拠点・担当者の CRM データは{' '}
          <Link href="/corporate" className="text-blue-600 hover:underline">
            企業管理者（CRM）
          </Link>
          から編集します。
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      <RoleTierPanel
        title="企業アカウント（テナント）"
        badge="Registration"
        ringClass="ring-violet-400/70"
        description="契約・請求・表示に使う企業名・所在地・代表者など。未入力はヘッダー表示に影響します。"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-700">内部テナント名</label>
            <input
              value={tenant?.name ?? ''}
              readOnly
              className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">企業表示名</label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={saving}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="株式会社サンプル"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">PJ 表示名</label>
            <input
              value={projectDisplayName}
              onChange={(e) => setProjectDisplayName(e.target.value)}
              disabled={saving}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="ヘッダーに出すプロジェクト名"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-700">本社所在地</label>
            <input
              value={headOfficeAddress}
              onChange={(e) => setHeadOfficeAddress(e.target.value)}
              disabled={saving}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">代表電話</label>
            <input
              value={headOfficePhone}
              onChange={(e) => setHeadOfficePhone(e.target.value)}
              disabled={saving}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">代表者名</label>
            <input
              value={representativeName}
              onChange={(e) => setRepresentativeName(e.target.value)}
              disabled={saving}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">アカウント状態</label>
            <select
              value={accountStatus}
              onChange={(e) => setAccountStatus(e.target.value)}
              disabled={saving}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="active">active</option>
              <option value="trial">trial</option>
              <option value="suspended">suspended</option>
            </select>
          </div>
        </div>
      </RoleTierPanel>

      <RoleTierPanel
        title="アカウントマネージャー（AM）"
        badge="AM"
        ringClass="ring-emerald-400/70"
        description="企業管理者が、任意のメンバーに AM としての表示・権限の目印を付けます（複数可）。"
      >
        {members.length === 0 ? (
          <p className="text-sm text-gray-500">メンバー一覧を取得できませんでした。</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => {
              const eff = effectiveRolesFromListItem(m)
              const roleLabel = eff.join(' · ')
              const checked = amIds.has(m.id)
              return (
                <li
                  key={m.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                    checked ? 'border-emerald-300 bg-emerald-50/60' : 'border-gray-200 bg-white'
                  }`}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAm(m.id)}
                      disabled={saving}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="min-w-0">
                      <span className="font-medium text-gray-900">{m.name}</span>
                      <span className="ml-2 text-xs text-gray-500">{m.email}</span>
                      <span className="mt-0.5 block text-[10px] text-gray-400">{roleLabel}</span>
                    </span>
                  </label>
                  {checked ? (
                    <span className="shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
                      AM
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </RoleTierPanel>

      <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={() => void load()}
          disabled={saving}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          再読込
        </button>
        <button
          type="button"
          onClick={() => void onSaveProfile()}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}
