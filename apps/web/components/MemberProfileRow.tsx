'use client'

import type { UserListItem } from '@/lib/calling-api'
import { formatMemberRegion } from '@/lib/member-display'

type MemberProfileRowProps = {
  member: UserListItem
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
export const MemberProfileRow = ({ member }: MemberProfileRowProps) => {
  const phone = (member.mobilePhone ?? '').trim()
  const email = (member.email ?? '').trim()

  return (
    <div className="flex gap-3 rounded-lg border border-gray-100 bg-white/90 px-3 py-2.5 shadow-sm">
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-slate-200 to-slate-300 ring-1 ring-gray-200">
        {member.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.profileImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-700">
            {initialsFromName(member.name)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5 text-xs">
        <div className="truncate font-semibold text-gray-900">{member.name || '（無名）'}</div>
        <div className="truncate text-gray-600">{formatMemberRegion(member)}</div>
        <div className="truncate text-gray-700">{email.length > 0 ? email : 'メール未設定'}</div>
        <div className="tabular-nums text-gray-700">
          {phone.length > 0 ? phone : '携帯未設定'}
        </div>
      </div>
    </div>
  )
}
