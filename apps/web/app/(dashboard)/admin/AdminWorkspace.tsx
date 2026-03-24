'use client'

import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { useSession } from 'next-auth/react'
import {
  createTenantInvitation,
  fetchTenantInvitations,
  revokeTenantInvitations,
  type TenantInvitationRow,
} from '@/lib/auth-api'
import {
  assignUserTierBox,
  fetchUsers,
  removeUserFromPj,
  type UserListItem,
} from '@/lib/calling-api'
import { formatRolesJa } from '@/lib/role-labels'
import { effectiveRolesFromListItem } from '@/lib/member-display'
import type { UserRole } from '@/lib/types'
import { GripVertical } from 'lucide-react'
import { MemberProfileRow } from '@/components/MemberProfileRow'

const TIER_ORDER_STORAGE_KEY = 'is-crm-admin-tier-order'

type TierKey = 'director' | 'is'

/** 一括「付与区分」: ディレクター / IS / PJ除名（メンバーシップ削除のみ） */
type BulkPjChoice = 'director' | 'is' | 'remove'

/** 横並び時の既定: 左 ディレクター → 右 ISメンバー（つまみで入れ替え可） */
const DEFAULT_TIER_ORDER: TierKey[] = ['director', 'is']

const TIER_META: Record<
  TierKey,
  { title: string; badge: string; body: string; ringClass: string }
> = {
  director: {
    title: 'ディレクター',
    badge: 'Tier 1',
    body: '',
    ringClass: 'ring-amber-400/80',
  },
  is: {
    title: 'ISメンバー',
    badge: 'Tier 2',
    body: '',
    ringClass: 'ring-sky-400/80',
  },
}

const INVITE_STATUS_LABEL: Record<TenantInvitationRow['status'], string> = {
  pending: '有効（未使用）',
  expired: '期限切れ',
  used: '利用済み',
}

/** 使用済み以外は未消費のため取り消しAPIの対象になり得る */
const canRevokeInvitationRow = (row: TenantInvitationRow): boolean => row.status !== 'used'

const loadTierOrder = (): TierKey[] => {
  if (typeof window === 'undefined') return DEFAULT_TIER_ORDER
  try {
    const raw = localStorage.getItem(TIER_ORDER_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      parsed.every((x) => x === 'director' || x === 'is')
    ) {
      return parsed as TierKey[]
    }
  } catch {
    /* 破損時は既定へ */
  }
  return DEFAULT_TIER_ORDER
}

/** メンバー行ドラッグ用（BOX順つまみの application/x-is-tier と分離） */
const MEMBER_DRAG_MIME = 'application/x-is-user-id'

/** Gmail 宛先欄などから貼り付けた塊を1件ずつのアドレスに分解（重複除去・簡易形式チェック） */
const parseInviteEmailsFromRaw = (raw: string): string[] => {
  const withoutBrackets = raw.replace(/[<>]/g, ' ')
  const parts = withoutBrackets.split(/[\s,;、\n\r\t]+/)
  const seen = new Set<string>()
  const out: string[] = []
  const simpleEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  for (const p of parts) {
    const e = p.trim().toLowerCase()
    if (!e || !simpleEmail.test(e) || seen.has(e)) continue
    seen.add(e)
    out.push(e)
  }
  return out
}

/** 一括PJロール用の既定BOX（IS専用枠と同じ判定） */
const inferPjTierForBulkRow = (m: UserListItem): TierKey => {
  const eff = effectiveRolesFromListItem(m)
  if (
    eff.includes('is_member') &&
    !eff.includes('director') &&
    !eff.some((r) => ['enterprise_admin', 'is_admin', 'developer'].includes(r))
  ) {
    return 'is'
  }
  return 'director'
}

const isEnterpriseAdminMember = (m: UserListItem): boolean =>
  effectiveRolesFromListItem(m).includes('enterprise_admin')

const isPjRemovalProtectedMember = (m: UserListItem): boolean =>
  effectiveRolesFromListItem(m).includes('enterprise_admin')

/** PJ未アサインなら除名、それ以外は membership の pjRole を優先 */
const inferBulkPjChoice = (m: UserListItem): BulkPjChoice => {
  if (isEnterpriseAdminMember(m)) {
    return inferPjTierForBulkRow(m)
  }
  if (m.projectAssignment == null) {
    return 'remove'
  }
  return m.projectAssignment.pjRole === 'is_member' ? 'is' : 'director'
}

const compareMemberOrder = (a: UserListItem, b: UserListItem): number => {
  const pa = isEnterpriseAdminMember(a) ? 0 : 1
  const pb = isEnterpriseAdminMember(b) ? 0 : 1
  if (pa !== pb) return pa - pb
  const an = (a.name ?? '').trim().toLowerCase()
  const bn = (b.name ?? '').trim().toLowerCase()
  return an.localeCompare(bn, 'ja')
}

/**
 * メンバー役職・招待。ディレクター／ISメンバーは lg 以上で横並び（既定は左ディレクター）。つまみで左右入れ替え。
 */
export const AdminWorkspace = () => {
  const { data: session, status } = useSession()
  const accessToken = session?.accessToken ?? ''
  const tenantId = session?.user?.tenantId ?? ''

  const roles = useMemo((): UserRole[] => {
    const r = session?.user?.roles
    if (r && r.length > 0) return r
    const one = session?.user?.role
    return one ? [one] : []
  }, [session?.user?.role, session?.user?.roles])
  const canManageInvites = roles.includes('enterprise_admin')
  const canReassignTier =
    roles.includes('enterprise_admin') || roles.includes('director')
  const isEnterpriseAdminSession = roles.includes('enterprise_admin')

  const [tierOrder, setTierOrder] = useState<TierKey[]>(DEFAULT_TIER_ORDER)
  const [hydrated, setHydrated] = useState(false)

  const [inviteEmailsRaw, setInviteEmailsRaw] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')

  /** 企業管理者: 所属メンバー一括で director / is_member 相当を PATCH */
  const [bulkJoinSelected, setBulkJoinSelected] = useState<Record<string, boolean>>({})
  const [bulkJoinChoice, setBulkJoinChoice] = useState<Record<string, BulkPjChoice>>({})
  const [bulkJoinLoading, setBulkJoinLoading] = useState(false)
  const [bulkJoinMessage, setBulkJoinMessage] = useState('')
  const [bulkJoinError, setBulkJoinError] = useState('')

  const [invitations, setInvitations] = useState<TenantInvitationRow[]>([])
  const [invListLoading, setInvListLoading] = useState(false)
  const [invListError, setInvListError] = useState('')
  const [inviteRevokeSelected, setInviteRevokeSelected] = useState<Record<string, boolean>>({})
  const [inviteRevokeLoading, setInviteRevokeLoading] = useState(false)
  const [inviteRevokeMessage, setInviteRevokeMessage] = useState('')
  const [inviteRevokeError, setInviteRevokeError] = useState('')

  const [members, setMembers] = useState<UserListItem[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState('')
  const [tierAssignError, setTierAssignError] = useState('')
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null)
  const [selfTierChangeHint, setSelfTierChangeHint] = useState('')

  const parsedInviteEmails = useMemo(
    () => parseInviteEmailsFromRaw(inviteEmailsRaw),
    [inviteEmailsRaw],
  )

  /**
   * BOX は排他表示。is_member と director / 管理ロールが同時に付いている行は Tier1 にだけ出す（重複・「移動したのに残る」見えを防ぐ）。
   */
  const directorMembers = useMemo(
    () =>
      members.filter((m) => {
        const eff = effectiveRolesFromListItem(m)
        return eff.some((r) =>
          ['director', 'enterprise_admin', 'is_admin', 'developer'].includes(r),
        )
      }),
    [members],
  )
  /** Tier2：is_member のみ（director・企業管理者・IS管理者・開発者と併記しない一覧） */
  const isTierMembers = useMemo(
    () =>
      members.filter((m) => {
        const eff = effectiveRolesFromListItem(m)
        if (!eff.includes('is_member')) return false
        if (eff.includes('director')) return false
        if (
          eff.some((r) =>
            ['enterprise_admin', 'is_admin', 'developer'].includes(r),
          )
        ) {
          return false
        }
        return true
      }),
    [members],
  )

  useEffect(() => {
    setTierOrder(loadTierOrder())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(TIER_ORDER_STORAGE_KEY, JSON.stringify(tierOrder))
  }, [tierOrder, hydrated])

  const refreshInvitations = useCallback(async () => {
    if (!accessToken || !tenantId || !canManageInvites) return
    setInvListLoading(true)
    setInvListError('')
    try {
      const rows = await fetchTenantInvitations(accessToken, tenantId)
      setInvitations(rows)
    } catch (e) {
      setInvListError((e as Error).message)
    } finally {
      setInvListLoading(false)
    }
  }, [accessToken, tenantId, canManageInvites])

  useEffect(() => {
    void refreshInvitations()
  }, [refreshInvitations])

  useEffect(() => {
    setInviteRevokeSelected((prev) => {
      const ids = new Set(invitations.map((r) => r.id))
      const next = { ...prev }
      for (const k of Object.keys(next)) {
        if (!ids.has(k)) delete next[k]
      }
      return next
    })
  }, [invitations])

  const refreshMembers = useCallback(async () => {
    if (!accessToken) return
    setMembersLoading(true)
    setMembersError('')
    try {
      const rows = await fetchUsers(accessToken)
      setMembers([...rows].sort(compareMemberOrder))
    } catch (e) {
      setMembersError((e as Error).message)
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    void refreshMembers()
  }, [refreshMembers])

  useEffect(() => {
    setBulkJoinChoice((prev) => {
      const next = { ...prev }
      const seen = new Set<string>()
      for (const m of members) {
        seen.add(m.id)
        if (next[m.id] === undefined) {
          next[m.id] = inferBulkPjChoice(m)
        }
      }
      for (const id of Object.keys(next)) {
        if (!seen.has(id)) {
          delete next[id]
        }
      }
      return next
    })
  }, [members])

  useEffect(() => {
    setBulkJoinSelected((prev) => {
      const seen = new Set(members.map((m) => m.id))
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        if (!seen.has(id)) {
          delete next[id]
        }
      }
      return next
    })
  }, [members])

  /** ディレクターは enterprise_admin / is_admin / developer 行をドラッグ不可（APIも403） */
  const canDragMemberForTierChange = (m: UserListItem): boolean => {
    if (!canReassignTier) return false
    if (isEnterpriseAdminSession) return true
    const eff = effectiveRolesFromListItem(m)
    return !eff.some((r) =>
      ['enterprise_admin', 'is_admin', 'developer'].includes(r),
    )
  }

  const handleDragStart = (key: TierKey) => (e: DragEvent) => {
    e.stopPropagation()
    e.dataTransfer.setData('application/x-is-tier', key)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleMemberDragStart = (m: UserListItem) => (e: DragEvent) => {
    if (!canDragMemberForTierChange(m)) return
    e.stopPropagation()
    e.dataTransfer.setData(MEMBER_DRAG_MIME, m.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDropOn = useCallback(
    (target: TierKey) => async (e: DragEvent) => {
      e.preventDefault()
      const userId = e.dataTransfer.getData(MEMBER_DRAG_MIME)
      if (userId) {
        if (!canReassignTier || !accessToken) return
        setTierAssignError('')
        setAssigningUserId(userId)
        try {
          await assignUserTierBox(
            accessToken,
            userId,
            target === 'director' ? 'director' : 'is',
          )
          await refreshMembers()
          if (userId === session?.user?.id) {
            setSelfTierChangeHint(
              '自分の役割区分を変更しました。トークン反映のため再ログインしてください。',
            )
          }
        } catch (err) {
          setSelfTierChangeHint('')
          setTierAssignError((err as Error).message)
        } finally {
          setAssigningUserId(null)
        }
        return
      }

      const from = e.dataTransfer.getData('application/x-is-tier') as TierKey
      if (!from || from === target) return
      setTierOrder((prev) => {
        const i = prev.indexOf(from)
        const j = prev.indexOf(target)
        if (i < 0 || j < 0) return prev
        const next = [...prev]
        next[i] = target
        next[j] = from
        return next
      })
    },
    [accessToken, canReassignTier, refreshMembers, session?.user?.id],
  )

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteMessage('')
    if (!accessToken || !tenantId) {
      setInviteMessage('ログイン情報が不足しています')
      return
    }
    const emails = parseInviteEmailsFromRaw(inviteEmailsRaw)
    if (emails.length === 0) {
      setInviteMessage('有効なメールアドレスを1件以上入力してください（複数は改行・カンマ・スペース区切り）')
      return
    }
    /** 招待は常に IS（Tier 2）。ディレクターは参加後に権限変更で付与 */
    const inviteRoles: UserRole[] = ['is_member']
    setInviteLoading(true)
    let ok = 0
    const failures: string[] = []
    try {
      for (const email of emails) {
        try {
          await createTenantInvitation(accessToken, tenantId, {
            email,
            roles: inviteRoles,
          })
          ok += 1
        } catch (err) {
          failures.push(`${email}: ${(err as Error).message}`)
        }
      }
      if (failures.length === 0) {
        setInviteMessage(
          `${ok}件の招待メールを送信しました（有効期限は約3日間です）`,
        )
        setInviteEmailsRaw('')
      } else {
        const head = failures.slice(0, 4).join(' / ')
        const more = failures.length > 4 ? ` 他${failures.length - 4}件` : ''
        setInviteMessage(
          ok > 0
            ? `${ok}件送信済み。失敗: ${head}${more}`
            : `送信に失敗しました: ${head}${more}`,
        )
      }
      if (ok > 0) {
        await refreshInvitations()
        await refreshMembers()
      }
    } catch (err) {
      setInviteMessage((err as Error).message)
    } finally {
      setInviteLoading(false)
    }
  }

  const handleInviteRevokeExecute = async () => {
    setInviteRevokeError('')
    setInviteRevokeMessage('')
    if (!accessToken || !tenantId) {
      setInviteRevokeError('ログイン情報が不足しています')
      return
    }
    const ids = invitations
      .filter((r) => inviteRevokeSelected[r.id] && canRevokeInvitationRow(r))
      .map((r) => r.id)
    if (ids.length === 0) {
      setInviteRevokeError('取り消し対象にチェックを入れてください')
      return
    }
    setInviteRevokeLoading(true)
    try {
      const { revoked } = await revokeTenantInvitations(accessToken, tenantId, ids)
      setInviteRevokeMessage(`${revoked}件の招待を取り消しました`)
      setInviteRevokeSelected({})
      await refreshInvitations()
    } catch (e) {
      setInviteRevokeError((e as Error).message)
    } finally {
      setInviteRevokeLoading(false)
    }
  }

  const handleBulkJoinApply = async () => {
    setBulkJoinMessage('')
    setBulkJoinError('')
    const targets = members.filter((m) => bulkJoinSelected[m.id])
    if (targets.length === 0) {
      setBulkJoinError('「対象に含める」を1名以上オンにしてください')
      return
    }
    if (!accessToken) {
      setBulkJoinError('ログイン情報が不足しています')
      return
    }
    setBulkJoinLoading(true)
    let touchedSelf = false
    try {
      let assignCount = 0
      let removeCount = 0
      for (const m of targets) {
        if (!canDragMemberForTierChange(m)) {
          throw new Error(
            `${m.name?.trim() || m.email}: このメンバーの配役は変更できません`,
          )
        }
        const choice = bulkJoinChoice[m.id] ?? inferBulkPjChoice(m)
        if (choice === 'remove') {
          if (isPjRemovalProtectedMember(m)) {
            throw new Error('企業管理者はPJから除名できません')
          }
          await removeUserFromPj(accessToken, m.id)
          removeCount += 1
        } else {
          await assignUserTierBox(accessToken, m.id, choice)
          assignCount += 1
        }
        if (m.id === session?.user?.id) {
          touchedSelf = true
        }
      }
      await refreshMembers()
      const parts: string[] = []
      if (assignCount > 0) {
        parts.push(`アサイン ${assignCount}名`)
      }
      if (removeCount > 0) {
        parts.push(`PJ除名 ${removeCount}名`)
      }
      setBulkJoinMessage(
        parts.length > 0 ? `${parts.join('、')}を反映しました` : '反映しました',
      )
      setBulkJoinSelected({})
      if (touchedSelf) {
        setSelfTierChangeHint(
          '自分の役割区分を変更しました。トークン反映のため再ログインしてください。',
        )
      }
    } catch (e) {
      setBulkJoinError((e as Error).message)
    } finally {
      setBulkJoinLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 text-sm text-gray-500">読み込み中…</div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">メンバー役職変更・メンバー招待</h1>
      <h2 className="mt-4 text-base font-semibold text-gray-900">メンバーの役職の変更</h2>
      <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed text-gray-700">
        <li>役職をドラッグアンドドロップで変更できます。</li>
        <li>
          企業の管理者（企業アカウント管理者）だけは、どの役職であっても、企業アカウント傘下のすべてのメンバーおよび自分自身の役職を自由に変更できます。
        </li>
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        この案件（PJ）への招待メールの送付・状況確認も、このページの下の方から行えます。
      </p>

      <div className="mt-6 space-y-6">
        <section aria-label="権限変更">
          {selfTierChangeHint ? (
            <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900" role="status">
              {selfTierChangeHint}
            </p>
          ) : null}
          {tierAssignError ? (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {tierAssignError}
            </p>
          ) : null}
          {membersError ? (
            <p className="mt-2 text-sm text-amber-800">
              メンバー一覧を取得できませんでした（ディレクター以上が必要です）: {membersError}
            </p>
          ) : null}
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-stretch">
            {tierOrder.map((key) => {
              const meta = TIER_META[key]
              const tierList = key === 'director' ? directorMembers : isTierMembers
              return (
                <article
                  key={key}
                  onDragOver={handleDragOver}
                  onDrop={handleDropOn(key)}
                  className={`flex min-h-[min(24rem,55vh)] min-w-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-slate-50/80 shadow-sm ring-2 ring-transparent lg:min-h-[min(28rem,60vh)] ${meta.ringClass}`}
                >
                  <div
                    draggable
                    onDragStart={handleDragStart(key)}
                    className="flex w-10 shrink-0 cursor-grab touch-none select-none flex-col items-center justify-center border-r border-gray-200 bg-gray-100/90 py-4 text-gray-500 hover:bg-gray-200/90 active:cursor-grabbing"
                    aria-label={`${meta.title}の表示順を入れ替えるつまみ`}
                    title="このつまみだけドラッグして左右の順序を入れ替え"
                  >
                    <GripVertical className="h-5 w-5" aria-hidden strokeWidth={2} />
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-gray-900">{meta.title}</h3>
                        {meta.body ? (
                          <p className="mt-1 text-xs text-gray-600">{meta.body}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                        {meta.badge}
                      </span>
                    </div>
                    <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-gray-200/80 pt-3">
                      <p className="mb-2 shrink-0 text-[11px] font-medium text-gray-500">
                        メンバー（{tierList.length} 名）
                      </p>
                      {membersLoading ? (
                        <p className="text-xs text-gray-500">読み込み中…</p>
                      ) : tierList.length === 0 ? (
                        <p className="text-xs text-gray-500">該当のメンバーはいません</p>
                      ) : (
                        <ul
                          className={`min-h-0 space-y-2 pr-1 ${
                            tierList.length > 5 ? 'max-h-[23rem] overflow-y-auto' : ''
                          }`}
                        >
                          {tierList.map((m) => {
                            const rowDraggable = canDragMemberForTierChange(m)
                            return (
                              <li
                                key={m.id}
                                draggable={rowDraggable}
                                onDragStart={handleMemberDragStart(m)}
                                title={
                                  rowDraggable
                                    ? '向かい側のコンテナにドラッグして役割を切り替え'
                                    : canReassignTier
                                      ? 'ディレクターはこのメンバーの役割変更はできません'
                                      : undefined
                                }
                                className={`rounded-lg ${rowDraggable ? 'cursor-grab active:cursor-grabbing' : ''} ${assigningUserId === m.id ? 'opacity-50' : ''}`}
                              >
                                <MemberProfileRow
                                  member={m}
                                  emphasized={isEnterpriseAdminMember(m)}
                                />
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          aria-label="PJ招待・配役"
        >
          <h2 className="text-sm font-semibold text-gray-900">PJ招待・所属メンバーの配役</h2>
          <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-gray-600">
            <li>招待メールの送付・招待一覧は企業アカウント管理者のみです。</li>
            <li>
              下の「招待メール」では複数アドレスを一度に送れ、役職は <strong className="font-medium text-gray-800">IS</strong>{' '}
              で招待されます。
            </li>
            <li>
              下の「所属メンバーのプロジェクトアサイン」は、企業管理者またはディレクターが、参加中メンバーを既定PJに
              <strong className="font-medium text-gray-800">ディレクター／ISメンバー</strong>
              として割り当てられます（<code className="rounded bg-gray-100 px-1">project_memberships</code> と同期）。
            </li>
          </ul>

          {!canManageInvites ? (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              招待の送信・一覧は<strong>企業アカウント管理者</strong>のみです。ディレクター・IS権限では閲覧のみ（一覧は取得できません）。
            </p>
          ) : (
            <form className="mt-4 space-y-3" onSubmit={handleSendInvite}>
              <div>
                <h3 className="text-xs font-semibold text-gray-900">招待メール</h3>
                <textarea
                  value={inviteEmailsRaw}
                  onChange={(e) => setInviteEmailsRaw(e.target.value)}
                  rows={6}
                  placeholder={
                    '複数まとめて貼り付けOK。改行・カンマ・スペース・読点で区切られた塊から、有効なアドレスだけを自動で拾います。\n' +
                    '招待はIS（Tier 2）で行われます。ディレクターへは参加後にこのページの権限変更で付与してください。\n\n' +
                    '例）a@example.com, b@example.com'
                  }
                  className="mt-2 w-full max-w-2xl rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                  autoComplete="off"
                  aria-label="招待メールアドレス（複数可）"
                />
                {parsedInviteEmails.length > 0 ? (
                  <div className="mt-2 max-w-2xl">
                    <p className="text-[11px] font-medium text-gray-500">
                      送信対象 {parsedInviteEmails.length} 件
                    </p>
                    <ul className="mt-1 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-gray-100 bg-slate-50/90 p-2">
                      {parsedInviteEmails.map((em) => (
                        <li
                          key={em}
                          className="rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[11px] text-gray-800"
                        >
                          {em}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : inviteEmailsRaw.trim().length > 0 ? (
                  <p className="mt-2 text-xs text-amber-800">
                    有効なメール形式の行が見つかりません。区切り文字を確認してください。
                  </p>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={inviteLoading || parsedInviteEmails.length === 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {inviteLoading
                  ? '送信中…'
                  : `招待メールを送る（IS・${parsedInviteEmails.length}件）`}
              </button>
            </form>
          )}

          {canReassignTier ? (
            <div className="mt-6 border-t border-gray-100 pt-4">
              <h3 className="text-xs font-semibold text-gray-900">所属メンバーのプロジェクトアサイン</h3>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                企業アカウントに参加中のメンバーをこのプロジェクトにアサインします。
              </p>
              <p className="mt-1 text-xs font-medium text-amber-900">
                ※強制アサイン — 本人の許可なくアサインします。
              </p>
              <p className="mt-2 text-xs text-gray-500">
                「対象に含める」で選び、付与区分は <strong className="font-medium text-gray-800">ディレクター</strong> /{' '}
                <strong className="font-medium text-gray-800">IS</strong> /{' '}
                <strong className="font-medium text-gray-800">PJから除名</strong> のいずれか1つだけ。
                PJアサインはドラッグ移動と同じ{' '}
                <code className="rounded bg-gray-100 px-0.5">PATCH /users/:id/tier</code>
                、除名は <code className="rounded bg-gray-100 px-0.5">DELETE /users/:id/pj-membership</code>{' '}
                （メンバーシップのみ削除・ロールは維持）。企業管理者行に「PJから除名」はありません。
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={
                    membersLoading || members.length === 0 || bulkJoinLoading
                  }
                  onClick={() => {
                    const all: Record<string, boolean> = {}
                    for (const m of members) {
                      all[m.id] = true
                    }
                    setBulkJoinSelected(all)
                  }}
                  className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  全員を対象にチェック
                </button>
                <button
                  type="button"
                  disabled={bulkJoinLoading}
                  onClick={() => setBulkJoinSelected({})}
                  className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  対象をクリア
                </button>
              </div>
              {bulkJoinError ? (
                <p className="mt-2 text-sm text-red-600" role="alert">
                  {bulkJoinError}
                </p>
              ) : null}
              {bulkJoinMessage ? (
                <p className="mt-2 text-sm text-emerald-800" role="status">
                  {bulkJoinMessage}
                </p>
              ) : null}
              {membersLoading ? (
                <p className="mt-3 text-xs text-gray-500">読み込み中…</p>
              ) : members.length === 0 ? (
                <p className="mt-3 text-xs text-gray-500">所属メンバーがいません</p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-50 text-gray-700">
                      <tr>
                        <th className="w-10 px-2 py-2 font-semibold" scope="col">
                          対象
                        </th>
                        <th className="min-w-[10rem] px-3 py-2 font-semibold" scope="col">
                          メンバー
                        </th>
                        <th className="min-w-[8rem] px-3 py-2 font-semibold" scope="col">
                          現在のロール
                        </th>
                        <th className="min-w-[14rem] px-3 py-2 font-semibold" scope="col">
                          付与区分（いずれか1つのみ）
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {members.map((m) => {
                        const choice = bulkJoinChoice[m.id] ?? inferBulkPjChoice(m)
                        const rolesJa = formatRolesJa(
                          effectiveRolesFromListItem(m) as UserRole[],
                        )
                        const rowEditable = canDragMemberForTierChange(m)
                        return (
                          <tr
                            key={m.id}
                            className={isEnterpriseAdminMember(m) ? 'bg-sky-50/70' : undefined}
                          >
                            <td className="px-2 py-2 align-top">
                              <input
                                type="checkbox"
                                checked={Boolean(bulkJoinSelected[m.id])}
                                onChange={(e) =>
                                  setBulkJoinSelected((p) => ({
                                    ...p,
                                    [m.id]: e.target.checked,
                                  }))
                                }
                                disabled={bulkJoinLoading}
                                className="rounded border-gray-300"
                                aria-label={`${m.name || m.email}を一括反映の対象に含める`}
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="font-medium text-gray-900">
                                {m.name?.trim() || '（無名）'}
                              </div>
                              <div className="text-gray-600">{m.email}</div>
                            </td>
                            <td className="px-3 py-2 align-top text-gray-700">{rolesJa}</td>
                            <td className="px-3 py-2 align-top">
                              <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-3">
                                <label
                                  className={`flex items-center gap-1.5 font-normal ${
                                    rowEditable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={choice === 'director'}
                                    onChange={() =>
                                      setBulkJoinChoice((p) => ({
                                        ...p,
                                        [m.id]: 'director',
                                      }))
                                    }
                                    disabled={!rowEditable || bulkJoinLoading}
                                    className="rounded border-gray-300"
                                  />
                                  ディレクター
                                </label>
                                <label
                                  className={`flex items-center gap-1.5 font-normal ${
                                    rowEditable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={choice === 'is'}
                                    onChange={() =>
                                      setBulkJoinChoice((p) => ({
                                        ...p,
                                        [m.id]: 'is',
                                      }))
                                    }
                                    disabled={!rowEditable || bulkJoinLoading}
                                    className="rounded border-gray-300"
                                  />
                                  IS
                                </label>
                                {isPjRemovalProtectedMember(m) ? null : (
                                  <label
                                    className={`flex items-center gap-1.5 font-normal ${
                                      rowEditable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={choice === 'remove'}
                                      onChange={() =>
                                        setBulkJoinChoice((p) => ({
                                          ...p,
                                          [m.id]: 'remove',
                                        }))
                                      }
                                      disabled={!rowEditable || bulkJoinLoading}
                                      className="rounded border-gray-300"
                                    />
                                    <span className="text-red-800">PJから除名</span>
                                  </label>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <button
                type="button"
                disabled={
                  bulkJoinLoading ||
                  membersLoading ||
                  !members.some((m) => bulkJoinSelected[m.id])
                }
                onClick={() => void handleBulkJoinApply()}
                className="mt-3 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {bulkJoinLoading ? '決定中…' : '配役決定'}
              </button>
            </div>
          ) : null}

          {inviteMessage ? (
            <p className="mt-3 text-sm text-gray-700" role="status">
              {inviteMessage}
            </p>
          ) : null}

          <div className="mt-6 border-t border-gray-100 pt-4">
            <h3 className="text-xs font-semibold text-gray-800">送付した招待の状況</h3>
            {!canManageInvites ? (
              <p className="mt-2 text-xs text-gray-500">—</p>
            ) : invListError ? (
              <p className="mt-2 text-sm text-red-600">{invListError}</p>
            ) : invListLoading ? (
              <p className="mt-2 text-sm text-gray-500">読み込み中…</p>
            ) : invitations.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">まだ招待履歴がありません</p>
            ) : (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={
                      inviteRevokeLoading ||
                      invListLoading ||
                      !invitations.some(
                        (r) => inviteRevokeSelected[r.id] && canRevokeInvitationRow(r),
                      )
                    }
                    onClick={() => void handleInviteRevokeExecute()}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {inviteRevokeLoading ? '取り消し中…' : '取り消し実行'}
                  </button>
                  <button
                    type="button"
                    disabled={inviteRevokeLoading}
                    onClick={() => {
                      const next: Record<string, boolean> = {}
                      for (const r of invitations) {
                        if (canRevokeInvitationRow(r)) {
                          next[r.id] = true
                        }
                      }
                      setInviteRevokeSelected(next)
                    }}
                    className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    全選択
                  </button>
                  <button
                    type="button"
                    disabled={inviteRevokeLoading}
                    onClick={() => setInviteRevokeSelected({})}
                    className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    選択解除
                  </button>
                </div>
                {inviteRevokeError ? (
                  <p className="mt-2 text-sm text-red-600" role="alert">
                    {inviteRevokeError}
                  </p>
                ) : null}
                {inviteRevokeMessage ? (
                  <p className="mt-2 text-sm text-emerald-800" role="status">
                    {inviteRevokeMessage}
                  </p>
                ) : null}
                <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-50 text-gray-700">
                      <tr>
                        <th className="w-10 px-2 py-2 font-semibold" scope="col">
                          取り消し
                        </th>
                        <th className="px-3 py-2 font-semibold">メール</th>
                        <th className="px-3 py-2 font-semibold">付与ロール</th>
                        <th className="px-3 py-2 font-semibold">ステータス</th>
                        <th className="px-3 py-2 font-semibold">期限</th>
                        <th className="px-3 py-2 font-semibold">送信日時</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {invitations.map((row) => {
                        const revokable = canRevokeInvitationRow(row)
                        return (
                          <tr key={row.id}>
                            <td className="px-2 py-2 align-top">
                              {revokable ? (
                                <input
                                  type="checkbox"
                                  checked={Boolean(inviteRevokeSelected[row.id])}
                                  onChange={(e) =>
                                    setInviteRevokeSelected((p) => ({
                                      ...p,
                                      [row.id]: e.target.checked,
                                    }))
                                  }
                                  disabled={inviteRevokeLoading}
                                  className="rounded border-gray-300"
                                  aria-label={`${row.email}の招待を取り消す対象に含める`}
                                />
                              ) : (
                                <span className="text-gray-400" title="利用済みのため取り消し不可">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-900">{row.email}</td>
                            <td className="px-3 py-2 text-gray-700">{formatRolesJa(row.roles)}</td>
                            <td className="px-3 py-2">
                              <span
                                className={
                                  row.status === 'pending'
                                    ? 'text-emerald-700'
                                    : row.status === 'used'
                                      ? 'text-gray-600'
                                      : 'text-amber-800'
                                }
                              >
                                {INVITE_STATUS_LABEL[row.status]}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-600">
                              {new Date(row.expiresAt).toLocaleString('ja-JP')}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-600">
                              {new Date(row.createdAt).toLocaleString('ja-JP')}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
