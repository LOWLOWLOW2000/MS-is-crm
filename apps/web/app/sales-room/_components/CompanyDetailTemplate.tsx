'use client'

import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Building2, Mail, Phone, PhoneForwarded, X } from 'lucide-react'
import { useCallSession } from '../_providers/CallSessionProvider'
import { CompanyDetailRightPanel } from './CompanyDetailRightPanel'
import { SalesRoomActionResultPanel } from './SalesRoomActionResultPanel'
import {
  fetchCompany,
  fetchListItemById,
  restoreLatestCompanySnapshot,
  updateCompany,
} from '@/lib/calling-api'
import type { CompanyDetailResponse, ListItem } from '@/lib/types'
import { findDuplicateEstablishmentPhones } from '../_lib/company-contact-dedupe'

const SAMPLE_PHONE_LIST = [
  { label: 'ブランチ丸の内', phone: '03-1234-5001' },
  { label: '本社・本部・本店', phone: '03-1234-5000' },
  { label: '営業本部直通', phone: '03-1234-5002' },
  { label: '情報システム部直通', phone: '03-1234-5003' },
]

/** 連絡アクション（電話一覧・担当者行のベース。タッチしやすい最小高さ） */
const contactActionBase =
  'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1'

/** 担当者行：部署電話と同じピル見た目（枠・角丸・高さを電話一覧に寄せる） */
const personaRowPill =
  'inline-flex max-w-full min-h-10 items-center gap-1.5 rounded-lg border border-emerald-400 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900 shadow-sm'

/** 電話・メールのみアイコン（正方形・タップ領域確保） */
const contactIconOnlyBtn =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-emerald-500'

/** 担当の部署が支店一覧に無い／未確定のときの既定（手入力は使わない） */
const DEFAULT_DEPARTMENT_UNKNOWN = '所属不明'

/** 拠点の種別（DB `Establishment.type` にそのまま保存。自由記述列のまま） */
const ESTABLISHMENT_TYPE_OPTIONS = [
  '本社・本部',
  '支店',
  '営業所',
  '運営施設',
  '工場・作業所',
  'その他',
] as const

const ESTABLISHMENT_HEAD_OFFICE_TYPE = '本社・本部'

/** 修正POPUP ウィザードのステップ表示（ヘッダ・フッタ・本文見出しで共通） */
const EDIT_WIZARD_STEP_META = [
  {
    label: '操作の説明',
    fractionLabel: '1/4',
    headerHint: '結論と3層の整理を読み、「次へ」で入力に進みます。',
  },
  {
    label: '会社',
    fractionLabel: '2/4',
    headerHint: '会社名・本社住所・ステータスを入力します。保存は最後のステップ後に可能です。',
  },
  {
    label: '支店・施設',
    fractionLabel: '3/4',
    headerHint: '名称は担当の部署プルダウンに反映されます。代表TEL は青ピル用です。',
  },
  {
    label: '担当者',
    fractionLabel: '4/4',
    headerHint: '追加・修正後、「保存する」で確定します。',
  },
] as const

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
  /** 親で useSearchParams から解決して渡す（ネストした useSearchParams による RSC 500 を避ける） */
  legalEntityId?: string
  listItemId?: string
}

export const CompanyDetailTemplate: React.FC<CompanyDetailTemplateProps> = ({
  legalEntityId: legalEntityIdProp = '',
  listItemId: listItemIdProp = '',
}) => {
  const { data: session } = useSession()
  const legalEntityId = legalEntityIdProp
  const listItemId = listItemIdProp

  type DisplayPersona = CompanyDetailResponse['personas'][number]

  const { setCurrentTarget } = useCallSession()

  const [displayPersonas, setDisplayPersonas] = useState<DisplayPersona[]>([])
  const [personasLoading, setPersonasLoading] = useState(false)

  const [listItem, setListItem] = useState<ListItem | null>(null)
  const [listItemLoading, setListItemLoading] = useState(false)

  /** POPUP 保存後に表示する部署・拠点の代表電話（API の Establishment に phone が無い場合の画面用） */
  const [localDeptPhones, setLocalDeptPhones] = useState<{ label: string; phone: string }[]>([])
  /** API 担当ゼロ件時、POPUP の担当をそのままピル表示 */
  const [localPersonaPills, setLocalPersonaPills] = useState<
    { id: string; department: string; name: string; phone: string; email: string }[] | null
  >(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!session?.accessToken || !legalEntityId) return
      setPersonasLoading(true)
      try {
        const company = await fetchCompany(session.accessToken, legalEntityId)
        if (cancelled) return
        setDisplayPersonas(company.personas)
      } catch {
        if (!cancelled) setDisplayPersonas([])
      } finally {
        if (!cancelled) setPersonasLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [session?.accessToken, legalEntityId])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!session?.accessToken || !listItemId) return
      setListItemLoading(true)
      try {
        const item = await fetchListItemById(session.accessToken, listItemId)
        if (cancelled) return
        setListItem(item)
      } catch {
        if (!cancelled) setListItem(null)
      } finally {
        if (!cancelled) setListItemLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [session?.accessToken, listItemId])

  const displayCallingId = listItem?.id ?? 'crec_001'
  const displayListName = listItem?.listName?.trim() || null
  const displayCompanyName = listItem?.companyName ?? '株式会社サンプル企業「本社」'
  const displayAddress = listItem?.address ?? '東京都千代田区丸の内1-1-1'
  const displayHpPart = listItem?.targetUrl
    ? `”HP：${listItem.targetUrl}”`
    : null

  // ------------------------------
  // 修正・担当追加（POPUP）
  // ------------------------------
  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editCanUndo, setEditCanUndo] = useState(false)
  /** 修正POPUP: 0=操作説明 → 1会社 / 2支店 / 3担当 */
  type EditWizardStep = 0 | 1 | 2 | 3
  const [editStep, setEditStep] = useState<EditWizardStep>(0)

  const [draftName, setDraftName] = useState('株式会社サンプル企業')
  const [draftHeadOfficeAddress, setDraftHeadOfficeAddress] = useState('東京都千代田区丸の内1-1-1')
  const [draftStatus, setDraftStatus] = useState('未精査')
  const [draftEstablishments, setDraftEstablishments] = useState<
    { name: string; address: string; type: string; phone: string }[]
  >([{ name: '本社', address: '東京都千代田区丸の内1-1-1', type: '本社', phone: '' }])
  const [draftPersonas, setDraftPersonas] = useState<
    { departmentName: string; name: string; phone: string; email: string }[]
  >([
    {
      departmentName: DEFAULT_DEPARTMENT_UNKNOWN,
      name: '山田 太郎',
      phone: '03-1234-5678',
      email: 'yamada@example.co.jp',
    },
  ])

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
            name:
              (e.type ?? '') === ESTABLISHMENT_HEAD_OFFICE_TYPE ? '' : e.name,
            address: e.address ?? '',
            type: e.type ?? '',
            phone: '',
          })),
        )
        setDraftPersonas(
          (company.personas ?? []).map((p) => ({
            departmentName: p.department?.name?.trim() || DEFAULT_DEPARTMENT_UNKNOWN,
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
    setEditStep(0)
    setEditOpen(true)
    await loadEditData()
  }

  const closeEdit = () => {
    setEditOpen(false)
    setEditStep(0)
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
        establishments: { name: string; address: string; type: string; phone?: string }[]
        personas: { departmentName: string; name: string; phone: string; email: string }[]
      }
      setDraftName(parsed.name)
      setDraftHeadOfficeAddress(parsed.headOfficeAddress)
      setDraftStatus(parsed.status)
      setDraftEstablishments(
        parsed.establishments.map((e) => ({
          name: e.name,
          address: e.address,
          type: e.type,
          phone: e.phone ?? '',
        })),
      )
      setDraftPersonas(parsed.personas)
      localStorage.removeItem(localUndoKey)
      setEditCanUndo(false)
    } catch {
      // ignore
    }
  }

  const applyPhoneDisplayFromDraft = () => {
    setLocalDeptPhones(
      draftEstablishments
        .map((e) => ({
          label: e.name.trim() || e.type.trim() || '拠点',
          phone: e.phone.trim(),
        }))
        .filter((x) => x.phone.length > 0),
    )
    const pills = draftPersonas
      .filter((p) => p.name.trim().length > 0)
      .map((p, i) => ({
        id: `local_p_${i}_${p.name.trim()}`,
        department: p.departmentName.trim(),
        name: p.name.trim(),
        phone: p.phone.trim(),
        email: p.email.trim(),
      }))
    return pills
  }

  const handleEditSave = async () => {
    setEditLoading(true)
    pushLocalUndo()
    const personaPills = applyPhoneDisplayFromDraft()
    try {
      if (session?.accessToken && legalEntityId) {
        const result = await updateCompany(session.accessToken, legalEntityId, {
          legalEntity: {
            name: draftName,
            headOfficeAddress: draftHeadOfficeAddress,
            status: draftStatus,
          },
          establishments: draftEstablishments
            .map((e) => {
              const t = e.type.trim()
              const n = e.name.trim()
              const resolvedName =
                t === ESTABLISHMENT_HEAD_OFFICE_TYPE ? ESTABLISHMENT_HEAD_OFFICE_TYPE : n
              return {
                name: resolvedName,
                address: e.address.trim(),
                type: t,
              }
            })
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
        setLocalPersonaPills(null)
        try {
          const company = await fetchCompany(session.accessToken, legalEntityId)
          setDisplayPersonas(company.personas)
        } catch {
          // ignore
        }
      } else {
        setEditCanUndo(true)
        setLocalPersonaPills(personaPills.length > 0 ? personaPills : null)
      }
    } catch {
      setEditCanUndo(true)
      setLocalPersonaPills(personaPills.length > 0 ? personaPills : null)
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
          (result.company.establishments ?? []).map((e) => ({
            name:
              (e.type ?? '') === ESTABLISHMENT_HEAD_OFFICE_TYPE ? '' : e.name,
            address: e.address ?? '',
            type: e.type ?? '',
            phone: '',
          })),
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

  const deptPhonePills = useMemo(() => {
    const base = localDeptPhones.length > 0 ? localDeptPhones : SAMPLE_PHONE_LIST
    const seen = new Set<string>()
    return base.filter((x) => {
      const k = x.phone.replace(/\D/g, '')
      if (!k || seen.has(k)) return false
      seen.add(k)
      return true
    })
  }, [localDeptPhones])

  const fallbackPersonaPills = useMemo(
    () => localPersonaPills ?? SAMPLE_PERSONAS,
    [localPersonaPills],
  )

  const establishmentDraftDupMsg = useMemo(
    () => findDuplicateEstablishmentPhones(draftEstablishments),
    [draftEstablishments],
  )

  const draftEstablishmentDeptOptions = useMemo(
    () => [...new Set(draftEstablishments.map((e) => e.name.trim()).filter(Boolean))],
    [draftEstablishments],
  )

  const editStepMeta = EDIT_WIZARD_STEP_META[editStep]

  return (
    <div className="relative rounded-md border border-gray-200 bg-white shadow-sm">
      {/* 修正・担当追加 POPUP */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/45 px-3 py-6 sm:px-6 sm:py-10">
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-6">
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold tracking-tight text-slate-950">会社・支店・担当の編集</div>
                <div className="mt-1 text-base font-semibold text-slate-900">
                  <span>{editStepMeta.label}</span>
                  <span className="font-medium text-slate-600">（{editStepMeta.fractionLabel}）</span>
                </div>
                <div className="mt-1.5 text-sm leading-relaxed text-slate-700">
                  {editStepMeta.headerHint}
                  {editCanUndo && editStep > 0 ? ' 直前の状態は上部の「もとに戻す」で戻せます。' : ''}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="min-h-11 rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  閉じる
                </button>
                <button
                  type="button"
                  disabled={
                    editLoading || (!editCanUndo && editStep < 3)
                  }
                  title={
                    !editCanUndo && editStep < 3
                      ? '最後のステップまで進むと保存できます'
                      : undefined
                  }
                  onClick={editCanUndo ? handleEditRestore : handleEditSave}
                  className={`min-h-11 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    editCanUndo ? 'bg-slate-700 hover:bg-slate-800' : 'bg-blue-600 hover:bg-blue-700'
                  } ${editLoading || (!editCanUndo && editStep < 3) ? 'opacity-60' : ''}`}
                >
                  {editCanUndo ? 'もとに戻す' : '保存する'}
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-8">
              {editLoading && (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-800">
                  読み込み中...
                </div>
              )}

              {editStep === 0 ? (
                <div className="mx-auto max-w-3xl space-y-6 py-2">
                  <p className="text-center text-2xl font-bold text-slate-950">
                    {editStepMeta.label}（{editStepMeta.fractionLabel}）
                  </p>
                  <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 px-5 py-6 text-slate-900 shadow-inner sm:px-8 sm:py-8">
                    <p className="border-b-2 border-slate-300 pb-3 text-center text-base font-bold tracking-wide text-slate-800">
                      修正
                    </p>
                    <p className="mt-6 text-lg font-bold leading-snug text-slate-950">
                      ■結論：「次へ」で、修正・追加の対象ページまで進み「保存する」で保存。
                    </p>
                    <p className="mt-8 text-lg font-semibold text-slate-900">リスト情報は3層構造です。</p>
                    <p className="mt-2 text-base leading-relaxed text-slate-900">
                      2層目からメンバーが変更・追記できます。
                    </p>
                    <ul className="mt-6 space-y-4 border-t-2 border-slate-200 pt-6 text-base leading-relaxed">
                      <li className="flex gap-3 sm:gap-4">
                        <span className="shrink-0 font-bold text-slate-950">1層：</span>
                        <span>法人格の情報ページ（日本法人APIからの情報・変更非対象）</span>
                      </li>
                      <li className="flex gap-3 sm:gap-4">
                        <span className="shrink-0 font-bold text-slate-950">2層：</span>
                        <span>法人・営業所・所在地系（住所など）</span>
                      </li>
                      <li className="flex gap-3 sm:gap-4">
                        <span className="shrink-0 font-bold text-slate-950">3層：</span>
                        <span>その所在地の組織系（課・所属者）</span>
                      </li>
                    </ul>
                  </div>
                  <p className="text-center text-base font-medium leading-relaxed text-slate-800">
                    読み終わったら、下の「次へ」で会社情報の入力に進みます。
                  </p>
                </div>
              ) : null}

              {editStep === 1 ? (
                <div className="mx-auto max-w-3xl rounded-xl border-2 border-slate-200 bg-white p-5 sm:p-6">
                  <div className="mb-4 text-lg font-bold text-slate-950">
                    {EDIT_WIZARD_STEP_META[1].label}（{EDIT_WIZARD_STEP_META[1].fractionLabel}）
                  </div>
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-slate-800">
                      会社名
                      <input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        className="mt-2 min-h-11 w-full rounded-lg border-2 border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm"
                      />
                    </label>
                    <label className="block text-sm font-semibold text-slate-800">
                      本社住所
                      <input
                        value={draftHeadOfficeAddress}
                        onChange={(e) => setDraftHeadOfficeAddress(e.target.value)}
                        className="mt-2 min-h-11 w-full rounded-lg border-2 border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm"
                      />
                    </label>
                    <label className="block text-sm font-semibold text-slate-800">
                      <span className="mb-2 block leading-relaxed text-slate-900">
                        ステータス｜情報保護法観点からHPとリスト内容が一致を人間が目視が必至となりました。現在の精査状況を選択下さい。
                      </span>
                      <span className="mb-3 block rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-normal leading-relaxed text-rose-900">
                        一度でも精査済みが選ばれれば、この企業アカウント内のあらゆる場所で同じ質問を問われません。
                      </span>
                      <select
                        value={draftStatus}
                        onChange={(e) => setDraftStatus(e.target.value)}
                        className="mt-2 min-h-11 w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm"
                      >
                        <option value="未精査">未精査</option>
                        <option value="精査済">精査済</option>
                        <option value="除外">除外</option>
                      </select>
                    </label>
                  </div>
                </div>
              ) : null}

              {editStep === 2 ? (
                <div className="rounded-xl border-2 border-slate-200 bg-white p-5 sm:p-6">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-lg font-bold text-slate-950">
                        {EDIT_WIZARD_STEP_META[2].label}（{EDIT_WIZARD_STEP_META[2].fractionLabel}）
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">
                        重複する代表TEL は入力中に警告します。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftEstablishments((prev) => [
                          ...prev,
                          { name: '', address: '', type: '', phone: '' },
                        ])
                      }
                      className="min-h-11 shrink-0 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700"
                    >
                      追加
                    </button>
                  </div>
                  {establishmentDraftDupMsg ? (
                    <div className="mb-4 rounded-lg border-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
                      {establishmentDraftDupMsg}
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    {draftEstablishments.map((e, i) => {
                      const isHeadOfficeType = e.type === ESTABLISHMENT_HEAD_OFFICE_TYPE
                      const rowTitle = isHeadOfficeType
                        ? ESTABLISHMENT_HEAD_OFFICE_TYPE
                        : e.name.trim() || `（未入力）`
                      const typeInPreset = (ESTABLISHMENT_TYPE_OPTIONS as readonly string[]).includes(
                        e.type ?? '',
                      )
                      return (
                        <div
                          key={`${e.name}-${i}`}
                          className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 sm:grid-cols-12 sm:gap-3"
                        >
                          <div className="flex flex-col gap-1 border-b border-slate-200 pb-2 sm:col-span-12 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <p className="text-sm font-bold text-slate-950">
                              <span className="text-slate-600">支店・施設</span>{' '}
                              <span className="tabular-nums text-blue-800">{i + 1}</span>
                              <span className="mx-1.5 font-normal text-slate-400">/</span>
                              <span className="text-base font-semibold text-slate-800">{rowTitle}</span>
                            </p>
                            <p className="text-xs leading-snug text-slate-600 sm:max-w-xs sm:text-right">
                              名称は担当の部署一覧に出ます。代表TEL は青ピル用です。
                            </p>
                          </div>
                          <label className="block text-sm font-semibold text-slate-800 sm:col-span-2">
                            種別
                            <select
                              value={e.type ?? ''}
                              onChange={(ev) => {
                                const v = ev.target.value
                                setDraftEstablishments((prev) =>
                                  prev.map((x, idx) =>
                                    idx === i
                                      ? {
                                          ...x,
                                          type: v,
                                          name: v === ESTABLISHMENT_HEAD_OFFICE_TYPE ? '' : x.name,
                                        }
                                      : x,
                                  ),
                                )
                              }}
                              className="mt-2 min-h-11 w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm"
                            >
                              <option value="">種別を選択</option>
                              {ESTABLISHMENT_TYPE_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                              {!typeInPreset && e.type ? (
                                <option value={e.type}>{e.type}（登録済・一覧外）</option>
                              ) : null}
                            </select>
                          </label>
                          <label className="block text-sm font-semibold text-slate-800 sm:col-span-3">
                            施設名を直接入力
                            {isHeadOfficeType ? (
                              <input
                                readOnly
                                disabled
                                value=""
                                placeholder="選択不要"
                                title="種別が本社・本部のときは入力不要です"
                                className="mt-2 min-h-11 w-full cursor-not-allowed rounded-lg border-2 border-dashed border-slate-300 bg-slate-100 px-3 py-2 text-base text-slate-500 placeholder:text-slate-400"
                              />
                            ) : (
                              <input
                                value={e.name}
                                onChange={(ev) =>
                                  setDraftEstablishments((prev) =>
                                    prev.map((x, idx) =>
                                      idx === i ? { ...x, name: ev.target.value } : x,
                                    ),
                                  )
                                }
                                placeholder="例：大阪支店"
                                className="mt-2 min-h-11 w-full rounded-lg border-2 border-slate-300 px-3 py-2 text-base"
                              />
                            )}
                          </label>
                          <label className="block text-sm font-semibold text-slate-800 sm:col-span-3">
                            代表TEL
                            <input
                              value={e.phone}
                              onChange={(ev) =>
                                setDraftEstablishments((prev) =>
                                  prev.map((x, idx) => (idx === i ? { ...x, phone: ev.target.value } : x))
                                )
                              }
                              placeholder="03-xxxx-xxxx"
                              className="mt-2 min-h-11 w-full rounded-lg border-2 border-slate-300 px-3 py-2 font-mono text-base"
                              inputMode="tel"
                            />
                          </label>
                          <label className="block text-sm font-semibold text-slate-800 sm:col-span-3">
                            住所
                            <input
                              value={e.address}
                              onChange={(ev) =>
                                setDraftEstablishments((prev) =>
                                  prev.map((x, idx) => (idx === i ? { ...x, address: ev.target.value } : x))
                                )
                              }
                              placeholder="所在地"
                              className="mt-2 min-h-11 w-full rounded-lg border-2 border-slate-300 px-3 py-2 text-base"
                            />
                          </label>
                          <div className="flex items-end justify-start sm:col-span-1 sm:justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setDraftEstablishments((prev) => prev.filter((_, idx) => idx !== i))
                              }
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                              aria-label={`支店・施設 ${i + 1} を削除`}
                            >
                              <X className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {editStep === 3 ? (
                <div className="rounded-xl border-2 border-slate-200 bg-white p-5 sm:p-6">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-lg font-bold text-slate-950">
                        {EDIT_WIZARD_STEP_META[3].label}（{EDIT_WIZARD_STEP_META[3].fractionLabel}）
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">
                        部署は支店・施設名から選ぶか、不明なときは「所属不明」。保存後は緑ピルに反映します。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftPersonas((prev) => [
                          ...prev,
                          {
                            departmentName: DEFAULT_DEPARTMENT_UNKNOWN,
                            name: '',
                            phone: '',
                            email: '',
                          },
                        ])
                      }
                      className="min-h-11 shrink-0 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700"
                    >
                      追加
                    </button>
                  </div>
                  <div className="space-y-4">
                    {draftPersonas.map((p, i) => {
                      const opts = draftEstablishmentDeptOptions
                      const dn = p.departmentName.trim()
                      const selVal =
                        dn === ''
                          ? ''
                          : dn === DEFAULT_DEPARTMENT_UNKNOWN
                            ? DEFAULT_DEPARTMENT_UNKNOWN
                            : opts.includes(dn)
                              ? dn
                              : DEFAULT_DEPARTMENT_UNKNOWN
                      const personaTitle =
                        p.name.trim() || (p.phone.trim() ? p.phone.trim() : `（未入力）`)
                      return (
                        <div
                          key={`${p.name}-${i}`}
                          className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-12 sm:gap-3"
                        >
                          <div className="flex flex-col gap-1 border-b border-slate-200 pb-2 sm:col-span-12 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <p className="text-sm font-bold text-slate-950">
                              <span className="text-slate-600">担当者</span>{' '}
                              <span className="tabular-nums text-emerald-800">{i + 1}</span>
                              <span className="mx-1.5 font-normal text-slate-400">/</span>
                              <span className="text-base font-semibold text-slate-800">{personaTitle}</span>
                            </p>
                            <p className="text-xs leading-snug text-slate-600 sm:max-w-xs sm:text-right">
                              保存後は緑ピルに表示されます。
                            </p>
                          </div>
                          <div className="col-span-12 sm:col-span-4">
                            <label className="mb-1 block text-sm font-semibold text-slate-800">部署</label>
                            <select
                              value={selVal}
                              onChange={(ev) => {
                                const v = ev.target.value
                                setDraftPersonas((prev) =>
                                  prev.map((x, idx) =>
                                    idx === i ? { ...x, departmentName: v } : x,
                                  ),
                                )
                              }}
                              className="min-h-11 w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-base text-slate-900"
                            >
                              <option value="">部署を選択</option>
                              {opts.map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                              <option value={DEFAULT_DEPARTMENT_UNKNOWN}>{DEFAULT_DEPARTMENT_UNKNOWN}</option>
                            </select>
                          </div>
                          <label className="col-span-6 block text-sm font-semibold text-slate-800 sm:col-span-2">
                            氏名
                            <input
                              value={p.name}
                              onChange={(ev) =>
                                setDraftPersonas((prev) =>
                                  prev.map((x, idx) => (idx === i ? { ...x, name: ev.target.value } : x))
                                )
                              }
                              placeholder="担当者氏名"
                              className="mt-2 min-h-11 w-full rounded-lg border-2 border-slate-300 px-3 py-2 text-base"
                            />
                          </label>
                          <label className="col-span-6 block text-sm font-semibold text-slate-800 sm:col-span-2">
                            直通TEL
                            <input
                              value={p.phone}
                              onChange={(ev) =>
                                setDraftPersonas((prev) =>
                                  prev.map((x, idx) => (idx === i ? { ...x, phone: ev.target.value } : x))
                                )
                              }
                              placeholder="担当者TEL"
                              className="mt-2 min-h-11 w-full rounded-lg border-2 border-slate-300 px-3 py-2 font-mono text-base"
                            />
                          </label>
                          <label className="col-span-10 block text-sm font-semibold text-slate-800 sm:col-span-3">
                            MAIL
                            <input
                              value={p.email}
                              onChange={(ev) =>
                                setDraftPersonas((prev) =>
                                  prev.map((x, idx) => (idx === i ? { ...x, email: ev.target.value } : x))
                                )
                              }
                              placeholder="MAIL"
                              className="mt-2 min-h-11 w-full rounded-lg border-2 border-slate-300 px-3 py-2 text-base"
                            />
                          </label>
                          <div className="col-span-2 flex items-end justify-end sm:col-span-1">
                            <button
                              type="button"
                              onClick={() => setDraftPersonas((prev) => prev.filter((_, idx) => idx !== i))}
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                              aria-label={`担当者 ${i + 1} を削除`}
                            >
                              <X className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t-2 border-slate-200 pt-6">
                <button
                  type="button"
                  disabled={editStep === 0}
                  onClick={() =>
                    setEditStep((s) => (s > 0 ? ((s - 1) as EditWizardStep) : s))
                  }
                  className="min-h-11 rounded-lg bg-black px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  戻る
                </button>
                <span className="min-w-0 flex-1 text-center text-sm font-semibold text-slate-800">
                  {editStepMeta.label}（{editStepMeta.fractionLabel}）
                </span>
                {editStep < 3 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setEditStep((s) => (s < 3 ? ((s + 1) as EditWizardStep) : s))
                    }
                    className="min-h-11 rounded-lg bg-black px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-neutral-900"
                  >
                    次へ
                  </button>
                ) : editCanUndo ? (
                  <span className="max-w-md text-right text-sm leading-relaxed text-slate-700">
                    <span className="block">・終了の場合は上部の閉じる</span>
                    <span className="block">・直前の状態に戻す場合は上部の「もとに戻す」</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={editLoading}
                    onClick={() => void handleEditSave()}
                    className="min-h-11 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-40"
                  >
                    保存する
                  </button>
                )}
              </div>

              <div className="mt-5 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
                DB保存は `legalEntityId` がURLにある場合に有効です（例: `?legalEntityId=...`）。無い場合でも、画面上はローカル履歴で「保存→もとに戻す」が動きます。
              </div>
            </div>
          </div>
        </div>
      )}

      {/* メイン：左＝詳細表示＋行動結果・メモ / 右＝タブ（トーク・HP・ルール・資料・メモ） */}
      <div className="flex min-h-0 flex-col gap-2 px-3 py-2 sm:flex-row sm:gap-3">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 sm:basis-0 sm:min-w-0 sm:flex-1">
          {/* 詳細表示：3行固定・縦幅は従来のコンパクト枠に合わせる */}
          <section
            className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 shadow-sm"
            aria-label="リスト明細・拠点概要"
          >
            <div className="flex min-w-0 flex-col gap-1.5 text-sm leading-snug">
              <div className="flex min-w-0 flex-nowrap items-baseline gap-x-2 sm:gap-x-3">
                <div className="flex min-w-0 flex-1 basis-0 items-baseline gap-1.5">
                  <span className="shrink-0 text-xs font-semibold text-gray-500">架電ID</span>
                  <span
                    className="min-w-0 flex-1 truncate font-mono font-semibold text-gray-900"
                    title={listItemLoading ? undefined : displayCallingId}
                  >
                    {listItemLoading ? '—' : displayCallingId}
                  </span>
                </div>
                <span className="shrink-0 text-gray-300" aria-hidden>
                  |
                </span>
                <div className="flex min-w-0 flex-1 basis-0 items-baseline gap-1.5">
                  <span className="shrink-0 text-xs font-semibold text-gray-500">リスト名</span>
                  <span
                    className="min-w-0 flex-1 truncate font-mono font-semibold text-gray-900"
                    title={listItemLoading ? undefined : displayListName ?? '—'}
                  >
                    {listItemLoading ? '—' : displayListName ?? '—'}
                  </span>
                </div>
              </div>
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 text-xs font-semibold text-gray-500">商号（支店など）</span>
                <div
                  className="line-clamp-1 min-w-0 flex-1 break-all text-gray-900"
                  title={
                    displayHpPart != null && displayHpPart !== ''
                      ? `${displayCompanyName} ${displayHpPart}`
                      : displayCompanyName
                  }
                >
                  <span className="font-semibold">{displayCompanyName}</span>
                  {displayHpPart != null && displayHpPart !== '' ? (
                    <span className="font-medium text-gray-700"> {displayHpPart}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 text-xs font-semibold text-gray-500">支店・施設 所在地</span>
                <span
                  className="line-clamp-1 min-w-0 flex-1 break-all text-gray-900"
                  title={listItemLoading ? undefined : displayAddress}
                >
                  {listItemLoading ? '—' : displayAddress}
                </span>
              </div>
            </div>
          </section>

          {/* 電話・担当：施設・担当の電話番号（ピル一覧・折りたたみ）。発信は各ピルから */}
          <section className="w-full space-y-2">
            <div className="flex flex-col gap-2 rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50/80 p-3 ring-indigo-100/80">
              <details className="group w-full">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-0.5 [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                      <Phone className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="text-sm font-bold tracking-tight text-indigo-950">電話・担当</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-indigo-950 hover:bg-indigo-100/50">
                    <span
                      className="inline-block text-[10px] text-indigo-600 transition-transform group-open:rotate-90"
                      aria-hidden
                    >
                      ▶
                    </span>
                    施設・担当の電話番号
                  </span>
                </summary>
                <div className="mt-2 border-t border-indigo-200/80 pt-2">
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-100 bg-white/70 p-2 shadow-inner">
                {deptPhonePills.map((item, idx) => (
                  <a
                    key={`${item.label}-${item.phone}-${idx}`}
                    href={`tel:${item.phone.replace(/\D/g, '')}`}
                    className={`${contactActionBase} max-w-full border border-sky-400 bg-sky-50 text-sky-900 hover:bg-sky-100 focus-visible:ring-sky-400`}
                    title={`${item.label}に発信`}
                    aria-label={`${item.label} ${item.phone} に発信`}
                    onClick={() =>
                      setCurrentTarget({
                        kind: 'phone',
                        label: item.label,
                        phone: item.phone,
                      })
                    }
                  >
                    <PhoneForwarded className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="max-w-[10rem] truncate sm:max-w-none">{item.label}</span>
                    <span className="font-mono text-[11px] text-sky-950">{item.phone}</span>
                  </a>
                ))}
                {personasLoading ? (
                  <span className="text-xs text-slate-500">担当者を読み込み中…</span>
                ) : displayPersonas.length > 0 ? (
                    displayPersonas.map((p) => {
                      const phone = p.phone ?? null
                      const email = (p as unknown as { email?: string | null }).email ?? null
                      const deptName = (p as unknown as { department?: { name?: string | null } | null })
                        .department?.name
                      const personaLabel = `${deptName ?? ''}${deptName ? ' ' : ''}${p.name}`

                      return (
                        <div key={p.id} className={`${personaRowPill} pr-1`}>
                          <PhoneForwarded className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                          <span className="max-w-[9rem] truncate sm:max-w-[14rem]">
                            <span className="text-emerald-700">{deptName ?? '—'}</span>
                            <span className="ml-1 font-semibold text-emerald-950">{p.name}</span>
                          </span>
                          <span className="shrink-0 font-mono text-[11px] text-emerald-950">
                            {phone ?? '—'}
                          </span>
                          {phone ? (
                            <a
                              href={`tel:${phone.replace(/\D/g, '')}`}
                              className={`${contactIconOnlyBtn} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
                              title={`${p.name} に電話`}
                              aria-label={`${p.name} に電話`}
                              onClick={() => {
                                setCurrentTarget({
                                  kind: 'persona',
                                  targetId: p.id,
                                  label: personaLabel,
                                  phone,
                                  email,
                                })
                              }}
                            >
                              <PhoneForwarded className="h-5 w-5" aria-hidden />
                            </a>
                          ) : (
                            <span
                              className={`${contactIconOnlyBtn} cursor-not-allowed border-emerald-200 bg-emerald-100/90 text-emerald-400`}
                              aria-disabled
                              title="電話番号なし"
                            >
                              <PhoneForwarded className="h-5 w-5 opacity-50" aria-hidden />
                            </span>
                          )}
                          {email ? (
                            <a
                              href={`mailto:${email}`}
                              className={`${contactIconOnlyBtn} border-emerald-500 bg-white text-emerald-900 hover:bg-emerald-100`}
                              title={`${p.name} にメール`}
                              aria-label={`${p.name} にメール`}
                              onClick={() => {
                                setCurrentTarget({
                                  kind: 'persona',
                                  targetId: p.id,
                                  label: personaLabel,
                                  phone: phone ?? '',
                                  email,
                                })
                              }}
                            >
                              <Mail className="h-5 w-5" aria-hidden />
                            </a>
                          ) : (
                            <span
                              className={`${contactIconOnlyBtn} cursor-not-allowed border-emerald-200 bg-emerald-100/90 text-emerald-400`}
                              aria-disabled
                              title="メールなし"
                            >
                              <Mail className="h-5 w-5 opacity-50" aria-hidden />
                            </span>
                          )}
                        </div>
                      )
                    })
                ) : (
                  fallbackPersonaPills.map((p) => (
                    <div key={p.id} className={`${personaRowPill} pr-1`}>
                      <PhoneForwarded className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                      <span className="max-w-[9rem] truncate sm:max-w-[14rem]">
                        <span className="text-emerald-700">{p.department}</span>
                        <span className="ml-1 font-semibold text-emerald-950">{p.name}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-emerald-950">{p.phone}</span>
                      <a
                        href={`tel:${p.phone.replace(/\D/g, '')}`}
                        className={`${contactIconOnlyBtn} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
                        title={`${p.name} に電話`}
                        aria-label={`${p.name} に電話`}
                        onClick={() => {
                          setCurrentTarget({
                            kind: 'persona',
                            targetId: p.id,
                            label: `${p.department} ${p.name}`,
                            phone: p.phone,
                            email: p.email,
                          })
                        }}
                      >
                        <PhoneForwarded className="h-5 w-5" aria-hidden />
                      </a>
                      <a
                        href={`mailto:${p.email}`}
                        className={`${contactIconOnlyBtn} border-emerald-500 bg-white text-emerald-900 hover:bg-emerald-100`}
                        title={`${p.name} にメール`}
                        aria-label={`${p.name} にメール`}
                        onClick={() => {
                          setCurrentTarget({
                            kind: 'persona',
                            targetId: p.id,
                            label: `${p.department} ${p.name}`,
                            phone: p.phone,
                            email: p.email,
                          })
                        }}
                      >
                        <Mail className="h-5 w-5" aria-hidden />
                      </a>
                    </div>
                  ))
                )}
                  </div>
                </div>
              </details>
            </div>

            <button
              type="button"
              onClick={() => void openEdit()}
              className="flex w-full min-h-[3.25rem] items-center gap-2 rounded-xl border-2 border-slate-300 bg-white p-3 text-left shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-white shadow-sm">
                <Building2 className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-sm font-bold tracking-tight text-slate-900">
                会社情報・支店情報・担当｜追加・修正
              </span>
            </button>
          </section>

          {/* 行動結果・メモ（左メイン内） */}
          <SalesRoomActionResultPanel />
        </div>

        <CompanyDetailRightPanel
          accessToken={session?.accessToken}
          listItem={listItem}
          listItemId={listItemId}
        />
      </div>
    </div>
  )
}

