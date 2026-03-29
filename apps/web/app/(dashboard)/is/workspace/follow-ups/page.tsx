'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useMemo, useState } from 'react'
import { IsAppointmentMaterialSection } from '../../_components/IsAppointmentMaterialSection'
import { useRecallListStore } from '@/lib/stores/recall-list-store'
import { SALES_ROOM_V2_BASE } from '@/lib/sales-room-paths'
import { downloadCallingRecordsExport } from '@/lib/calling-api'
import type { UserRole } from '@/lib/types'

const TENANT_EXPORT_ROLES: UserRole[] = ['director', 'is_admin', 'enterprise_admin', 'developer']

const PAGE_SIZE = 8

const formatScheduled = (ms: number): string => {
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 再架電（ローカル）＋ アポ・資料（API）
 */
export default function IsWorkspaceFollowUpsPage() {
  const { data: session, status } = useSession()
  const accessToken = session?.accessToken?.trim() ? session.accessToken : null
  const recallItems = useRecallListStore((s) => s.items)
  const removeRecall = useRecallListStore((s) => s.remove)
  const [recallPage, setRecallPage] = useState(0)
  const [exportErr, setExportErr] = useState<string | null>(null)

  const roles: UserRole[] = useMemo(() => {
    const r = session?.user?.roles
    if (r && r.length > 0) return r
    if (session?.user?.role) return [session.user.role]
    return []
  }, [session?.user?.role, session?.user?.roles])

  const canTenantExport = roles.some((role) => TENANT_EXPORT_ROLES.includes(role))

  const runExport = async (format: 'csv' | 'xlsx', scope: 'self' | 'tenant') => {
    if (!accessToken) return
    setExportErr(null)
    try {
      await downloadCallingRecordsExport(accessToken, { format, scope })
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : 'ダウンロードに失敗しました')
    }
  }

  const recallTotalPages = Math.max(1, Math.ceil(recallItems.length / PAGE_SIZE))
  const recallSlice = useMemo(() => {
    const start = recallPage * PAGE_SIZE
    return recallItems.slice(start, start + PAGE_SIZE)
  }, [recallItems, recallPage])

  if (status === 'loading') {
    return <p className="text-lg text-gray-700">読み込み中…</p>
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">フォローアップ</h1>
        <p className="mt-2 text-lg text-gray-800">
          再架電の予定と、登録したアポ・資料請求をまとめて確認します。
        </p>
      </header>

      <section className="space-y-4" aria-labelledby="recall-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="recall-heading" className="text-xl font-bold text-gray-900">
            再架電リスト（このブラウザに保存）
          </h2>
          <Link
            href={SALES_ROOM_V2_BASE}
            className="inline-flex min-h-[44px] items-center text-base font-semibold text-blue-800 underline"
          >
            架電ルームで追加・架電する
          </Link>
        </div>
        <p className="text-base text-gray-800">
          営業ルームの行動結果から登録した予定です。別端末とは共有されません。
        </p>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-base">
              <thead className="bg-gray-100 text-left text-sm font-bold text-gray-800">
                <tr>
                  <th className="border-b border-gray-200 px-4 py-3">予定日時</th>
                  <th className="border-b border-gray-200 px-4 py-3">会社名</th>
                  <th className="border-b border-gray-200 px-4 py-3">リンク</th>
                  <th className="border-b border-gray-200 px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {recallItems.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-gray-700" colSpan={4}>
                      予定はありません
                    </td>
                  </tr>
                ) : (
                  recallSlice.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="border-b border-gray-100 px-4 py-3 font-semibold text-gray-900">
                        {formatScheduled(item.scheduledAt)}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3 text-gray-900">{item.companyName}</td>
                      <td className="border-b border-gray-100 px-4 py-3">
                        <Link
                          href={item.pageLink}
                          className="font-medium text-blue-700 underline"
                        >
                          開く
                        </Link>
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3">
                        <button
                          type="button"
                          onClick={() => removeRecall(item.id)}
                          className="rounded-lg border-2 border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {recallItems.length > PAGE_SIZE ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3">
              <span className="text-base text-gray-800">
                {recallPage + 1} / {recallTotalPages} ページ
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={recallPage <= 0}
                  onClick={() => setRecallPage((p) => Math.max(0, p - 1))}
                  className="min-h-[44px] rounded-lg border-2 border-gray-300 px-4 text-base font-semibold disabled:opacity-40"
                >
                  前へ
                </button>
                <button
                  type="button"
                  disabled={recallPage >= recallTotalPages - 1}
                  onClick={() => setRecallPage((p) => Math.min(recallTotalPages - 1, p + 1))}
                  className="min-h-[44px] rounded-lg border-2 border-gray-300 px-4 text-base font-semibold disabled:opacity-40"
                >
                  次へ
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {accessToken ? (
        <section className="space-y-3" aria-labelledby="export-heading">
          <h2 id="export-heading" className="text-xl font-bold text-gray-900">
            架電記録のダウンロード
          </h2>
          <p className="text-base text-gray-800">
            自分が登録した架電記録を CSV または Excel で取得できます。
            {canTenantExport ? ' 管理者・ディレクターはテナント全体も取得できます。' : ''}
          </p>
          {exportErr ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-base text-red-900" role="alert">
              {exportErr}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void runExport('csv', 'self')}
              className="min-h-[44px] rounded-lg border-2 border-gray-300 bg-white px-4 text-base font-semibold text-gray-900 hover:bg-gray-50"
            >
              自分の記録（CSV）
            </button>
            <button
              type="button"
              onClick={() => void runExport('xlsx', 'self')}
              className="min-h-[44px] rounded-lg border-2 border-gray-300 bg-white px-4 text-base font-semibold text-gray-900 hover:bg-gray-50"
            >
              自分の記録（Excel）
            </button>
            {canTenantExport ? (
              <>
                <button
                  type="button"
                  onClick={() => void runExport('csv', 'tenant')}
                  className="min-h-[44px] rounded-lg border-2 border-blue-300 bg-blue-50 px-4 text-base font-semibold text-blue-950 hover:bg-blue-100"
                >
                  テナント全体（CSV）
                </button>
                <button
                  type="button"
                  onClick={() => void runExport('xlsx', 'tenant')}
                  className="min-h-[44px] rounded-lg border-2 border-blue-300 bg-blue-50 px-4 text-base font-semibold text-blue-950 hover:bg-blue-100"
                >
                  テナント全体（Excel）
                </button>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {accessToken ? (
        <IsAppointmentMaterialSection accessToken={accessToken} readable />
      ) : (
        <p className="text-lg text-gray-700">アポ・資料一覧を表示するにはログインが必要です</p>
      )}
    </div>
  )
}
