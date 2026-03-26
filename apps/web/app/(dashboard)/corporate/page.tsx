'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchMyCompany, restoreLatestCompanySnapshot, updateCompany } from '@/lib/calling-api'
import { useSession } from 'next-auth/react'
import type { CompanyDetailResponse, UpdateCompanyInput } from '@/lib/types'

/**
 * 企業管理者用: 企業情報（法人・拠点・担当者）を編集する
 */
export default function CorporatePage() {
  const { data: session } = useSession()
  const accessToken = (session as unknown as { accessToken?: string } | null)?.accessToken ?? null

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [company, setCompany] = useState<CompanyDetailResponse | null>(null)

  const [companyName, setCompanyName] = useState('')
  const [headOfficeAddress, setHeadOfficeAddress] = useState('')
  const [status, setStatus] = useState('')

  const [personaName, setPersonaName] = useState('')
  const [personaDepartmentName, setPersonaDepartmentName] = useState('')
  const [personaPhone, setPersonaPhone] = useState('')
  const [personaEmail, setPersonaEmail] = useState('')

  const canUndo = useMemo(() => Boolean((company as unknown as { canUndo?: boolean } | null)?.canUndo), [company])

  useEffect(() => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    fetchMyCompany(accessToken)
      .then((data) => {
        setCompany(data)
        setCompanyName(data.name)
        setHeadOfficeAddress(data.headOfficeAddress ?? '')
        setStatus(data.status ?? '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : '企業情報の取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [accessToken])

  const buildUpdateInput = (base: CompanyDetailResponse): UpdateCompanyInput => {
    const personas = [
      ...base.personas.map((p) => ({
        name: p.name,
        departmentName: p.department?.name ?? undefined,
        phone: p.phone ?? undefined,
        email: p.email ?? undefined,
      })),
      ...(personaName.trim().length > 0
        ? [
            {
              name: personaName.trim(),
              departmentName: personaDepartmentName.trim() || undefined,
              phone: personaPhone.trim() || undefined,
              email: personaEmail.trim() || undefined,
            },
          ]
        : []),
    ]

    return {
      legalEntity: {
        name: companyName.trim(),
        headOfficeAddress: headOfficeAddress.trim() || undefined,
        status: status.trim() || undefined,
      },
      establishments: base.establishments.map((e) => ({
        name: e.name,
        address: e.address ?? undefined,
        type: e.type ?? undefined,
      })),
      personas,
    }
  }

  const onSave = async () => {
    if (!accessToken || !company) return
    setSaving(true)
    setError(null)
    try {
      const input = buildUpdateInput(company)
      const result = await updateCompany(accessToken, company.id, input)
      setCompany(result.company)
      setPersonaName('')
      setPersonaDepartmentName('')
      setPersonaPhone('')
      setPersonaEmail('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    }
    setSaving(false)
  }

  const onUndo = async () => {
    if (!accessToken || !company) return
    setSaving(true)
    setError(null)
    try {
      const result = await restoreLatestCompanySnapshot(accessToken, company.id)
      setCompany(result.company)
      setCompanyName(result.company.name)
      setHeadOfficeAddress(result.company.headOfficeAddress ?? '')
      setStatus(result.company.status ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : '復元に失敗しました')
    }
    setSaving(false)
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">企業管理者</h1>
        <p className="mt-1 text-sm text-gray-600">企業情報の作成・更新（MVP: 法人情報＋担当者の追加）</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">法人情報</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onUndo}
              disabled={!company || saving || !canUndo}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              もとに戻す
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!company || saving}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              保存
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">企業名</label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={loading || saving}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">ステータス</label>
            <input
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={loading || saving}
              placeholder="active"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-700">本社住所</label>
            <input
              value={headOfficeAddress}
              onChange={(e) => setHeadOfficeAddress(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={loading || saving}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">担当者（追加）</h2>
        <p className="mt-1 text-xs text-gray-500">入力して「保存」で担当者を追記します（MVP: 削除/編集は後回し）。</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">氏名</label>
            <input
              value={personaName}
              onChange={(e) => setPersonaName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={loading || saving}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">部署</label>
            <input
              value={personaDepartmentName}
              onChange={(e) => setPersonaDepartmentName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={loading || saving}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">電話</label>
            <input
              value={personaPhone}
              onChange={(e) => setPersonaPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={loading || saving}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">メール</label>
            <input
              value={personaEmail}
              onChange={(e) => setPersonaEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={loading || saving}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
