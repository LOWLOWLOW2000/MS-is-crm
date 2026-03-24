'use client'

import type { UserListItem } from '@/lib/calling-api'
import { formatMemberRegion } from '@/lib/member-display'

type MemberProfileRowProps = {
  member: UserListItem
  emphasized?: boolean
}

/** イニシャル2文字（プロフ画像なし時） */
const initialsFromName = (name: string): string => {
  const t = name.trim()
  if (t.length === 0) return '?'
  const parts = t.split(/[\s　]+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  }
  return t.slice(0, 2).toUpperCase()
}

/**
 * 管理BOX内のメンバー1行。プロフ画像・名前・住所（国旗・都道府県）・メール・携帯。
 */
export const MemberProfileRow = ({ member, emphasized = false }: MemberProfileRowProps) => {
  const phone = (member.mobilePhone ?? '').trim()
  const email = (member.email ?? '').trim()

  return (
    <div
      className={`flex gap-3 rounded-lg border px-3 py-2.5 shadow-sm ${
        emphasized
          ? 'border-sky-200 bg-sky-50/90'
          : 'border-gray-100 bg-white/90'
      }`}
    >
      <div
        className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br ring-1 ${
          emphasized
            ? 'from-sky-200 to-sky-300 ring-sky-200'
            : 'from-slate-200 to-slate-300 ring-gray-200'
        }`}
      >
        {member.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.profileImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className={`flex h-full w-full items-center justify-center text-xs font-bold ${
              emphasized ? 'text-sky-800' : 'text-slate-700'
            }`}
          >
            {initialsFromName(member.name)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5 text-xs">
        <div className="flex items-center gap-2">
          <div className="truncate font-semibold text-gray-900">{member.name || '（無名）'}</div>
          {emphasized ? (
            <span className="shrink-0 rounded-full border border-sky-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-sky-700">
              企業管理者
            </span>
          ) : null}
        </div>
        <div className="truncate text-gray-600">{formatMemberRegion(member)}</div>
        <div className="truncate text-gray-700">{email.length > 0 ? email : 'メール未設定'}</div>
        <div className="tabular-nums text-gray-700">
          {phone.length > 0 ? phone : '携帯未設定'}
        </div>
      </div>
    </div>
  )
}
