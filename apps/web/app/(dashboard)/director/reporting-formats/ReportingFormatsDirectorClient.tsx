'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { fetchReportingFormats, upsertReportingFormat } from '@/lib/calling-api'
import {
  REPORTING_SCHEMA_KINDS,
  type ReportingSchemaField,
  type ReportingSchemaKind,
} from '@/lib/reporting-format-schema'
import type { ReportingFormatDefinitionRow, UserRole } from '@/lib/types'

const DIRECTOR_EDIT_ROLES: UserRole[] = ['director', 'is_admin', 'enterprise_admin', 'developer']

const KIND_META: { kind: ReportingSchemaKind; title: string; hint: string }[] = [
  {
    kind: 'common_header',
    title: '共通（全行動結果）',
    hint: 'どの行動結果でも架電ルームに表示されます（例: 案件メモ）。',
  },
  {
    kind: 'appointment',
    title: 'アポ時',
    hint: '行動結果が「アポ」のとき、共通に続けて表示されます。',
  },
  {
    kind: 'material_request',
    title: '資料送付時',
    hint: '行動結果が「資料送付」のとき、共通に続けて表示されます。',
  },
]

const emptyField = (): ReportingSchemaField => ({
  id: '',
  label: '',
  type: 'text',
  required: false,
})

/**
 * ディレクター: テナント別の報告フォーマット（JSON fields）を編集する。
 */
export function ReportingFormatsDirectorClient() {
  const { data: session, status } = useSession()
  const token = session?.accessToken?.trim() ?? ''

  const canEdit = useMemo(() => {
    const roles =
      session?.user?.roles && session.user.roles.length > 0
        ? session.user.roles
        : session?.user?.role
          ? [session.user.role]
          : []
    return roles.some((r) => DIRECTOR_EDIT_ROLES.includes(r))
  }, [session?.user?.role, session?.user?.roles])

  const [fieldsByKind, setFieldsByKind] = useState<Record<ReportingSchemaKind, ReportingSchemaField[]>>(() => {
    const init = {} as Record<ReportingSchemaKind, ReportingSchemaField[]>
    for (const k of REPORTING_SCHEMA_KINDS) init[k] = [emptyField()]
    return init
  })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [savingKind, setSavingKind] = useState<ReportingSchemaKind | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setMessage(null)
    setLoading(true)
    try {
      const list = await fetchReportingFormats(token)
      setFieldsByKind((prev) => {
        const next = { ...prev }
        for (const k of REPORTING_SCHEMA_KINDS) {
          const row = list.find((r: ReportingFormatDefinitionRow) => r.kind === k)
          const raw = row?.schemaJson?.fields
          if (Array.isArray(raw) && raw.length > 0) {
            const parsed = raw
              .map((item): ReportingSchemaField | null => {
                if (!item || typeof item !== 'object' || Array.isArray(item)) return null
                const o = item as Record<string, unknown>
                const id = typeof o.id === 'string' ? o.id : ''
                const label = typeof o.label === 'string' ? o.label : ''
                const t = o.type
                const type: ReportingSchemaField['type'] =
                  t === 'textarea' || t === 'select' || t === 'text' ? t : 'text'
                const options = Array.isArray(o.options)
                  ? o.options.filter((x): x is string => typeof x === 'string')
                  : []
                return {
                  id,
                  label,
                  type,
                  required: o.required === true,
                  options: type === 'select' && options.length > 0 ? options : undefined,
                }
              })
              .filter((x): x is ReportingSchemaField => x !== null)
            next[k] = parsed.length > 0 ? parsed : [emptyField()]
          } else {
            next[k] = [emptyField()]
          }
        }
        return next
      })
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (status === 'loading') return
    if (!token || !canEdit) {
      setLoading(false)
      return
    }
    void load()
  }, [status, token, canEdit, load])

  const buildSchemaJson = (fields: ReportingSchemaField[]): Record<string, unknown> => {
    const cleaned = fields
      .map((f) => ({
        id: f.id.trim(),
        label: f.label.trim(),
        type: f.type,
        ...(f.required ? { required: true } : {}),
        ...(f.type === 'select' && f.options && f.options.length > 0
          ? { options: f.options.map((o) => o.trim()).filter(Boolean) }
          : {}),
      }))
      .filter((f) => f.id.length > 0 && f.label.length > 0)
    return { fields: cleaned }
  }

  const saveKind = async (kind: ReportingSchemaKind) => {
    if (!token) return
    setSavingKind(kind)
    setMessage(null)
    try {
      await upsertReportingFormat(token, kind, buildSchemaJson(fieldsByKind[kind]))
      setMessage(`${KIND_META.find((m) => m.kind === kind)?.title ?? kind} を保存しました`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSavingKind(null)
    }
  }

  const updateField = (kind: ReportingSchemaKind, index: number, patch: Partial<ReportingSchemaField>) => {
    setFieldsByKind((prev) => {
      const list = [...prev[kind]]
      const cur = list[index]
      if (!cur) return prev
      list[index] = { ...cur, ...patch }
      if (patch.type && patch.type !== 'select') {
        list[index] = { ...list[index], options: undefined }
      }
      return { ...prev, [kind]: list }
    })
  }

  const addField = (kind: ReportingSchemaKind) => {
    setFieldsByKind((prev) => ({ ...prev, [kind]: [...prev[kind], emptyField()] }))
  }

  const removeField = (kind: ReportingSchemaKind, index: number) => {
    setFieldsByKind((prev) => ({
      ...prev,
      [kind]: prev[kind].filter((_, i) => i !== index).length > 0
        ? prev[kind].filter((_, i) => i !== index)
        : [emptyField()],
    }))
  }

  if (status === 'loading') {
    return <p className="text-sm text-zinc-600">読み込み中…</p>
  }

  if (!session) {
    return (
      <p className="text-sm text-zinc-600">
        <Link href="/login" className="text-blue-700 underline">
          ログイン
        </Link>
        が必要です。
      </p>
    )
  }

  if (!canEdit) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        この画面はディレクターまたは管理者のみ利用できます。
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">★報告フォーマット編集</h1>
        <p className="mt-2 text-sm text-zinc-600">
          架電ルームの「行動結果・メモ」に表示する追加項目を、テナント単位で定義します。id
          は保存データ（structuredReport）のキーになるため、英数字とアンダースコア推奨です。
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          <Link href="/sales-room/v2" className="text-blue-700 underline">
            架電ルーム
          </Link>
          で結果を選ぶと、ここで設定したフィールドが自動表示されます。
        </p>
      </header>

      {message ? (
        <p
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-600">フォーマットを読み込み中…</p>
      ) : (
        <div className="space-y-10">
          {KIND_META.map(({ kind, title, hint }) => (
            <section
              key={kind}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
              aria-labelledby={`heading-${kind}`}
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id={`heading-${kind}`} className="text-lg font-semibold text-zinc-900">
                    {title}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">{hint}</p>
                  <p className="mt-1 font-mono text-[11px] text-zinc-400">kind: {kind}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addField(kind)}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                  >
                    フィールドを追加
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveKind(kind)}
                    disabled={savingKind !== null}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingKind === kind ? '保存中…' : 'このブロックを保存'}
                  </button>
                </div>
              </div>

              <ul className="space-y-4">
                {fieldsByKind[kind].map((field, index) => (
                  <li
                    key={`${kind}-${index}`}
                    className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-500">フィールド {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeField(kind, index)}
                        className="text-xs font-medium text-red-700 hover:underline"
                      >
                        削除
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm text-zinc-700">
                        id（キー）
                        <input
                          value={field.id}
                          onChange={(e) => updateField(kind, index, { id: e.target.value })}
                          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-sm"
                          placeholder="meetingAt"
                        />
                      </label>
                      <label className="block text-sm text-zinc-700">
                        ラベル（表示名）
                        <input
                          value={field.label}
                          onChange={(e) => updateField(kind, index, { label: e.target.value })}
                          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                          placeholder="面談日時"
                        />
                      </label>
                      <label className="block text-sm text-zinc-700">
                        入力タイプ
                        <select
                          value={field.type}
                          onChange={(e) =>
                            updateField(kind, index, {
                              type: e.target.value as ReportingSchemaField['type'],
                            })
                          }
                          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                        >
                          <option value="text">1行テキスト</option>
                          <option value="textarea">複数行</option>
                          <option value="select">選択（プルダウン）</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2 pt-6 text-sm text-zinc-700">
                        <input
                          type="checkbox"
                          checked={field.required === true}
                          onChange={(e) => updateField(kind, index, { required: e.target.checked })}
                          className="h-4 w-4 rounded border-zinc-400"
                        />
                        必須（UI表示のみ。送信チェックは今後拡張可）
                      </label>
                    </div>
                    {field.type === 'select' ? (
                      <label className="mt-3 block text-sm text-zinc-700">
                        選択肢（1行に1つ）
                        <textarea
                          value={(field.options ?? []).join('\n')}
                          onChange={(e) =>
                            updateField(kind, index, {
                              options: e.target.value
                                .split('\n')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          rows={4}
                          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-xs"
                          placeholder={'メール\nFAX\n郵送'}
                        />
                      </label>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <footer className="border-t border-zinc-200 pt-6 text-xs text-zinc-500">
        API: GET/PUT <code className="rounded bg-zinc-100 px-1">/calling/reporting-formats</code> ／
        種別は common_header / appointment / material_request 固定です。
      </footer>
    </div>
  )
}
