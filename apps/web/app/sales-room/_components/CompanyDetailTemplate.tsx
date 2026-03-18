'use client'

import type React from 'react'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SalesRoomActionResultPanel } from './SalesRoomActionResultPanel'
import { fetchCompany, restoreLatestCompanySnapshot, updateCompany, updateListItemStatus } from '@/lib/calling-api'

const SAMPLE_PHONE_LIST = [
  { label: 'ブランチ丸の内', phone: '03-1234-5001' },
  { label: '本社・本部・本店', phone: '03-1234-5000' },
  { label: '営業本部直通', phone: '03-1234-5002' },
  { label: '情報システム部直通', phone: '03-1234-5003' },
]

const SAMPLE_PERSONAS = [
  {
    id: 'p_001',
    department: '営業本部',
    name: '山田 太郎',
    phone: '03-1234-5678',
    email: 'yamada@example.co.jp',
  },
  {
    id: 'p_002',
    department: '情報システム部',
    name: '佐藤 花子',
    phone: '03-1234-5679',
    email: 'sato@example.co.jp',
  },
]

export interface CompanyDetailTemplateProps {
  /** 互換性維持用。今回の実装では内部で固定レイアウトにするため未使用 */
  centerPanel?: React.ReactNode
}

export const CompanyDetailTemplate: React.FC<CompanyDetailTemplateProps> = () => {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const legalEntityId = searchParams.get('legalEntityId') ?? searchParams.get('company') ?? ''
  const listItemId = searchParams.get('listItemId') ?? ''

  /** 架電状態 */
  const [isCallActive, setIsCallActive] = useState(false)
  const [isOnHold, setIsOnHold] = useState(false)
  const [isDialPadOpen, setIsDialPadOpen] = useState(false)
  const [dialNumber, setDialNumber] = useState('')
  const [currentTarget, setCurrentTarget] = useState<{
    label: string
    phone: string
  } | null>(null)

  const statusLabel = isCallActive ? (isOnHold ? '保留中' : '架電中') : '待機中'
  const targetText =
    currentTarget != null
      ? `${currentTarget.label} / ${currentTarget.phone}`
      : '（発信先未選択）'

  const handleDialPadDigit = (digit: string) => {
    setDialNumber((prev) => (prev + digit).slice(0, 16))
  }

  const handleDialPadClear = () => {
    setDialNumber('')
  }

  const handleDialPadCall = () => {
    const phone = dialNumber || currentTarget?.phone || ''
    if (!phone) {
      // 発信先がない場合は何もしない（将来トースト表示など）
      return
    }
    setIsCallActive(true)
    setIsOnHold(false)
    setIsDialPadOpen(false)
  }

  const handleClickCallSegment = () => {
    if (isCallActive) {
      // 通話中 → 切る
      setIsCallActive(false)
      setIsOnHold(false)
      setDialNumber('')
      return
    }
    // 待機中 → ダイヤルパッド呼出
    setIsDialPadOpen(true)
  }

  const handleClickHold = () => {
    if (!isCallActive) return
    setIsOnHold((prev) => !prev)
  }

  const handleClickEmergency = () => {
    // 将来: ディレクターへの WebRTC 呼び出しをトリガー
    // 現状は UI モックのみ
    // eslint-disable-next-line no-alert
    alert('ディレクターに緊急コール（モック）')
  }

  const handleBack = () => {
    // 将来: 一覧へ戻る/前の企業へ戻る等に差し替え
    // eslint-disable-next-line no-alert
    alert('戻る（モック）')
  }

  const handleSendNext = () => {
    const ok = confirm('この企業を完了（done）にして次へ進みます。よろしいですか？')
    if (!ok) return
    const run = async () => {
      if (!session?.accessToken || !listItemId) {
        // eslint-disable-next-line no-alert
        alert('listItemId が無いため、完了更新はスキップしました（モック）')
        return
      }
      try {
        await updateListItemStatus(session.accessToken, listItemId, 'done')
        // eslint-disable-next-line no-alert
        alert('完了にしました（done）')
      } catch {
        // eslint-disable-next-line no-alert
        alert('完了更新に失敗しました')
      }
    }
    void run()
  }

  // ------------------------------
  // 修正・担当追加（POPUP）
  // ------------------------------
  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editCanUndo, setEditCanUndo] = useState(false)

  const [draftName, setDraftName] = useState('株式会社サンプル企業')
  const [draftHeadOfficeAddress, setDraftHeadOfficeAddress] = useState('東京都千代田区丸の内1-1-1')
  const [draftStatus, setDraftStatus] = useState('未精査')
  const [draftEstablishments, setDraftEstablishments] = useState<
    { name: string; address: string; type: string }[]
  >([{ name: '本社', address: '東京都千代田区丸の内1-1-1', type: '本社' }])
  const [draftPersonas, setDraftPersonas] = useState<
    { departmentName: string; name: string; phone: string; email: string }[]
  >([{ departmentName: '営業本部', name: '山田 太郎', phone: '03-1234-5678', email: 'yamada@example.co.jp' }])

  const localUndoKey = `company-edit-undo:${legalEntityId || 'unknown'}`

  const loadEditData = async () => {
    setEditLoading(true)
    try {
      if (session?.accessToken && legalEntityId) {
        const company = await fetchCompany(session.accessToken, legalEntityId)
        setDraftName(company.name)
        setDraftHeadOfficeAddress(company.headOfficeAddress ?? '')
        setDraftStatus(company.status ?? '未精査')
        setDraftEstablishments(
          (company.establishments ?? []).map((e) => ({
            name: e.name,
            address: e.address ?? '',
            type: e.type ?? '',
          }))
        )
        setDraftPersonas(
          (company.personas ?? []).map((p) => ({
            departmentName: p.department?.name ?? '',
            name: p.name,
            phone: p.phone ?? '',
            email: p.email ?? '',
          }))
        )
        // API側の canUndo は update/restore の戻りで管理する想定。ここではローカルのみ参照。
      }
      const raw = typeof window !== 'undefined' ? localStorage.getItem(localUndoKey) : null
      setEditCanUndo(Boolean(raw))
    } finally {
      setEditLoading(false)
    }
  }

  const openEdit = async () => {
    setEditOpen(true)
    await loadEditData()
  }

  const pushLocalUndo = () => {
    if (typeof window === 'undefined') return
    const snapshot = {
      name: draftName,
      headOfficeAddress: draftHeadOfficeAddress,
      status: draftStatus,
      establishments: draftEstablishments,
      personas: draftPersonas,
    }
    localStorage.setItem(localUndoKey, JSON.stringify(snapshot))
    setEditCanUndo(true)
  }

  const restoreLocalUndo = () => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem(localUndoKey)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as {
        name: string
        headOfficeAddress: string
        status: string
        establishments: { name: string; address: string; type: string }[]
        personas: { departmentName: string; name: string; phone: string; email: string }[]
      }
      setDraftName(parsed.name)
      setDraftHeadOfficeAddress(parsed.headOfficeAddress)
      setDraftStatus(parsed.status)
      setDraftEstablishments(parsed.establishments)
      setDraftPersonas(parsed.personas)
      localStorage.removeItem(localUndoKey)
      setEditCanUndo(false)
    } catch {
      // ignore
    }
  }

  const handleEditSave = async () => {
    setEditLoading(true)
    pushLocalUndo()
    try {
      if (session?.accessToken && legalEntityId) {
        const result = await updateCompany(session.accessToken, legalEntityId, {
          legalEntity: {
            name: draftName,
            headOfficeAddress: draftHeadOfficeAddress,
            status: draftStatus,
          },
          establishments: draftEstablishments
            .map((e) => ({ name: e.name.trim(), address: e.address.trim(), type: e.type.trim() }))
            .filter((e) => e.name.length > 0),
          personas: draftPersonas
            .map((p) => ({
              name: p.name.trim(),
              departmentName: p.departmentName.trim(),
              phone: p.phone.trim(),
              email: p.email.trim(),
            }))
            .filter((p) => p.name.length > 0),
        })
        setEditCanUndo(result.canUndo)
      } else {
        setEditCanUndo(true)
      }
    } catch {
      // API失敗時でもローカルUndoで挙動は維持
      setEditCanUndo(true)
    } finally {
      setEditLoading(false)
    }
  }

  const handleEditRestore = async () => {
    setEditLoading(true)
    try {
      if (session?.accessToken && legalEntityId) {
        const result = await restoreLatestCompanySnapshot(session.accessToken, legalEntityId)
        setDraftName(result.company.name)
        setDraftHeadOfficeAddress(result.company.headOfficeAddress ?? '')
        setDraftStatus(result.company.status ?? '未精査')
        setDraftEstablishments(
          (result.company.establishments ?? []).map((e) => ({ name: e.name, address: e.address ?? '', type: e.type ?? '' }))
        )
        setDraftPersonas(
          (result.company.personas ?? []).map((p) => ({
            departmentName: p.department?.name ?? '',
            name: p.name,
            phone: p.phone ?? '',
            email: p.email ?? '',
          }))
        )
        setEditCanUndo(result.canUndo)
        if (typeof window !== 'undefined') localStorage.removeItem(localUndoKey)
        return
      }
    } catch {
      // ignore
    } finally {
      setEditLoading(false)
    }
    restoreLocalUndo()
  }

  return (
    <div className="relative rounded-md border border-gray-200 bg-white shadow-sm">
      {/* ヘッダ：詳細表示（リスト名）＋ リスト変更 UI */}
      <header className="flex flex-wrap items-center justify-start gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-gray-600">リスト変更→</span>
          <select className="rounded border border-gray-300 bg-white px-3 py-1.5 text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option>再架電</option>
            <option>履歴</option>
            <option>AIリスト</option>
          </select>
          <button
            type="button"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-600 hover:border-gray-400 hover:bg-gray-50"
          >
            一覧
          </button>
          <button
            type="button"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50"
            onClick={openEdit}
          >
            修正・担当追加
          </button>

          {/* 目立つ「戻る」「次へ送る」 */}
          <div className="ml-0 flex items-center gap-1.5 sm:ml-2">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-md bg-blue-600 text-[10px] font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
              <span className="leading-none">前</span>
            </button>
            <button
              type="button"
              onClick={handleSendNext}
              className="inline-flex h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-md bg-blue-600 text-[10px] font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
              <span className="leading-none">次</span>
            </button>
          </div>
        </div>
      </header>

      {/* 修正・担当追加 POPUP */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 px-4 py-10">
          <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">修正・担当追加</div>
                <div className="text-[11px] text-slate-500">
                  会社情報の編集は履歴として保存され、必要なら「もとに戻す」で直前に戻せます。
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  閉じる
                </button>
                <button
                  type="button"
                  disabled={editLoading}
                  onClick={editCanUndo ? handleEditRestore : handleEditSave}
                  className={`rounded px-3 py-1.5 text-xs font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                    editCanUndo ? 'bg-slate-700 hover:bg-slate-800' : 'bg-blue-600 hover:bg-blue-700'
                  } ${editLoading ? 'opacity-60' : ''}`}
                >
                  {editCanUndo ? 'もとに戻す' : '保存する'}
                </button>
              </div>
            </div>

            <div className="p-4">
              {editLoading && (
                <div className="mb-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  読み込み中...
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-800">会社</div>
                  <div className="space-y-2">
                    <label className="block text-[11px] text-slate-600">
                      会社名
                      <input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="block text-[11px] text-slate-600">
                      本社住所
                      <input
                        value={draftHeadOfficeAddress}
                        onChange={(e) => setDraftHeadOfficeAddress(e.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="block text-[11px] text-slate-600">
                      ステータス
                      <select
                        value={draftStatus}
                        onChange={(e) => setDraftStatus(e.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                      >
                        <option value="未精査">未精査</option>
                        <option value="精査済">精査済</option>
                        <option value="除外">除外</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-800">支店・施設</div>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftEstablishments((prev) => [...prev, { name: '', address: '', type: '' }])
                      }
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      追加
                    </button>
                  </div>
                  <div className="space-y-2">
                    {draftEstablishments.map((e, i) => (
                      <div key={`${e.name}-${i}`} className="grid grid-cols-12 gap-2">
                        <input
                          value={e.name}
                          onChange={(ev) =>
                            setDraftEstablishments((prev) =>
                              prev.map((x, idx) => (idx === i ? { ...x, name: ev.target.value } : x))
                            )
                          }
                          placeholder="名称"
                          className="col-span-4 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                        <input
                          value={e.address}
                          onChange={(ev) =>
                            setDraftEstablishments((prev) =>
                              prev.map((x, idx) => (idx === i ? { ...x, address: ev.target.value } : x))
                            )
                          }
                          placeholder="住所"
                          className="col-span-5 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                        <input
                          value={e.type}
                          onChange={(ev) =>
                            setDraftEstablishments((prev) =>
                              prev.map((x, idx) => (idx === i ? { ...x, type: ev.target.value } : x))
                            )
                          }
                          placeholder="種別"
                          className="col-span-2 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setDraftEstablishments((prev) => prev.filter((_, idx) => idx !== i))}
                          className="col-span-1 rounded border border-slate-300 bg-white text-[11px] text-slate-600 hover:bg-slate-50"
                          aria-label="削除"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-800">担当</div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftPersonas((prev) => [
                        ...prev,
                        { departmentName: '', name: '', phone: '', email: '' },
                      ])
                    }
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    追加
                  </button>
                </div>
                <div className="space-y-2">
                  {draftPersonas.map((p, i) => (
                    <div key={`${p.name}-${i}`} className="grid grid-cols-12 gap-2">
                      <input
                        value={p.departmentName}
                        onChange={(ev) =>
                          setDraftPersonas((prev) =>
                            prev.map((x, idx) => (idx === i ? { ...x, departmentName: ev.target.value } : x))
                          )
                        }
                        placeholder="部署"
                        className="col-span-3 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                      <input
                        value={p.name}
                        onChange={(ev) =>
                          setDraftPersonas((prev) =>
                            prev.map((x, idx) => (idx === i ? { ...x, name: ev.target.value } : x))
                          )
                        }
                        placeholder="氏名"
                        className="col-span-2 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                      <input
                        value={p.phone}
                        onChange={(ev) =>
                          setDraftPersonas((prev) =>
                            prev.map((x, idx) => (idx === i ? { ...x, phone: ev.target.value } : x))
                          )
                        }
                        placeholder="TEL"
                        className="col-span-3 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                      <input
                        value={p.email}
                        onChange={(ev) =>
                          setDraftPersonas((prev) =>
                            prev.map((x, idx) => (idx === i ? { ...x, email: ev.target.value } : x))
                          )
                        }
                        placeholder="MAIL"
                        className="col-span-3 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setDraftPersonas((prev) => prev.filter((_, idx) => idx !== i))}
                        className="col-span-1 rounded border border-slate-300 bg-white text-[11px] text-slate-600 hover:bg-slate-50"
                        aria-label="削除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                DB保存は `legalEntityId` がURLにある場合に有効です（例: `?legalEntityId=...`）。無い場合でも、画面上はローカル履歴で「保存→もとに戻す」が動きます。
              </div>
            </div>
          </div>
        </div>
      )}

      {/* メイン：左＝詳細表示＋行動結果・メモ / 右＝トークスクリプト（7:3 レイアウト） */}
      <div className="flex min-h-0 flex-col gap-2 px-3 py-2 sm:flex-row sm:gap-3">
        {/* 左 7 */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 sm:basis-2/3 sm:max-w-[70%]">
          {/* 詳細表示（※※※）エリア（サンプル） */}
          <section className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 shadow-sm">
            <div className="flex flex-col gap-1.5 text-xs">
              <div>
                <span className="font-medium text-gray-500">架電ID</span>
                <span className="ml-1.5 font-mono font-medium text-gray-900">crec_001</span>
              </div>
              <div className="text-sm font-semibold text-gray-900">
                商号（支店など）
                <span className="ml-1">株式会社サンプル企業「本社」</span>
              </div>
              <div className="text-xs">
                <span className="font-medium text-gray-500">支店・施設 所在地</span>
                <span className="ml-1 text-gray-900">東京都千代田区丸の内1-1-1</span>
              </div>
            </div>
          </section>

          {/* 電話一覧（押下で発信）＋ 担当者（TEL / MAIL） */}
          <section className="w-full space-y-2">
            <div className="flex w-full flex-wrap items-center gap-1.5 text-sm font-semibold">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-800">
                電話一覧（押下で発信）
              </span>
              {SAMPLE_PHONE_LIST.map((item) => (
                <a
                  key={item.label}
                  href={`tel:${item.phone.replace(/-/g, '')}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-800 hover:bg-sky-100"
                  title={`${item.label}に発信`}
                  aria-label={`${item.label}に発信`}
                  onClick={() =>
                    setCurrentTarget({
                      label: item.label,
                      phone: item.phone,
                    })
                  }
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V21a2 2 0 01-2 2h-1C9.716 23 3 16.284 3 8V5z"
                    />
                  </svg>
                  <span>{item.label}</span>
                  <span className="font-mono">{item.phone}</span>
                </a>
              ))}
            </div>

            <div className="flex w-full flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-800">
                担当者（TEL / MAIL）
              </span>
              {SAMPLE_PERSONAS.map((p) => (
                <div
                  key={p.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900"
                >
                  <span className="text-emerald-700">{p.department}</span>
                  <span className="font-semibold text-emerald-950">{p.name}</span>
                  <a
                    href={`tel:${p.phone.replace(/-/g, '')}`}
                    className="inline-flex items-center gap-0.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-700"
                    title={`${p.name} に電話`}
                    aria-label={`${p.name} に電話`}
                  >
                    TEL
                  </a>
                  <a
                    href={`mailto:${p.email}`}
                    className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-200"
                    title={`${p.name} にメール`}
                    aria-label={`${p.name} にメール`}
                  >
                    MAIL
                  </a>
                </div>
              ))}
            </div>
          </section>

          {/* 架電ステータスパネル（行動結果・メモ と 電話一覧の間の横長バー） */}
          <section className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              {/* 左：ステータス表示 */}
              <div className="space-y-0.5">
                <div>
                  <span className="font-semibold text-slate-600">状況：</span>
                  <span className="font-medium text-emerald-700">{statusLabel}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-600">発信先：</span>
                  <span className="font-medium text-slate-900">{targetText}</span>
                </div>
              </div>

              {/* 右：電話セクション（3セグメントパネル） */}
              <div className="mt-2 grid w-full min-w-[220px] grid-cols-3 gap-0.5 overflow-hidden rounded-md border border-slate-300 bg-slate-100 text-[11px] font-semibold sm:mt-0 sm:max-w-xs">
                {/* 電話操作パネル（ダイヤルパッド呼出 / 切る） */}
                <button
                  type="button"
                  onClick={handleClickCallSegment}
                  className={`flex flex-col items-center justify-center px-2 py-2 ${
                    isCallActive ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  <span className="mb-0.5 inline-flex h-4 w-4 items-center justify-center rounded-sm bg-white/90 text-[9px] font-bold text-emerald-700">
                    {isCallActive ? '■' : '▶'}
                  </span>
                  <span className="leading-tight">
                    {isCallActive ? '通話を切る' : 'ダイヤルパッド呼出'}
                  </span>
                </button>

                {/* 保留パネル */}
                <button
                  type="button"
                  onClick={handleClickHold}
                  className={`flex flex-col items-center justify-center border-l border-r border-slate-300 px-2 py-2 ${
                    isOnHold ? 'bg-amber-200 text-amber-900' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  <span className="mb-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white">
                    ♪
                  </span>
                  <span className="leading-tight">保留</span>
                </button>

                {/* 緊急パネル（ディレクター呼出） */}
                <button
                  type="button"
                  onClick={handleClickEmergency}
                  className="flex flex-col items-center justify-center bg-yellow-300 px-2 py-2 text-yellow-950 hover:bg-yellow-400"
                >
                  <span className="mb-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    !
                  </span>
                  <span className="leading-tight">緊急</span>
                </button>
              </div>
            </div>
          </section>

          {/* 行動結果・メモ（左メイン内） */}
          <SalesRoomActionResultPanel />
        </div>

        {/* 右 3：トークスクリプト縦長 */}
        <aside className="min-h-0 shrink-0 rounded-md border border-indigo-100 bg-indigo-50/40 px-3 py-2 text-[11px] text-gray-800 sm:basis-1/3 sm:max-w-[30%]">
          <div className="mb-1 flex items-center justify-between gap-2 border-b border-indigo-100 pb-1">
            <h3 className="text-xs font-semibold text-indigo-900">トークスクリプト</h3>
            <span className="text-[10px] text-indigo-700">詳細編集は「トーク」タブから</span>
          </div>
          <div className="mt-1 h-full min-h-[160px] rounded border border-indigo-100 bg-white/95 p-2 leading-relaxed">
            <p className="text-gray-600">
              管理職がセットしたトークスクリプトと、自分で書いたトークスクリプトの要約がここに表示されます。
            </p>
          </div>
        </aside>
      </div>

      {/* ダイヤルパッド（モック） */}
      {isDialPadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xs rounded-lg border border-slate-300 bg-white p-4 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">ダイヤルパッド</h3>
              <button
                type="button"
                onClick={() => setIsDialPadOpen(false)}
                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
              >
                閉じる
              </button>
            </div>
            <div className="mb-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-sm text-slate-900">
              {dialNumber || currentTarget?.phone || '番号を入力'}
            </div>
            <div className="grid grid-cols-3 gap-1 text-sm">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDialPadDigit(d)}
                  className="flex h-9 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50"
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleDialPadClear}
                className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                クリア
              </button>
              <button
                type="button"
                onClick={handleDialPadCall}
                className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <span className="inline-block h-3 w-3 rounded-sm bg-white/90" />
                発信
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

