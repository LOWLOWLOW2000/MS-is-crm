import type { UserListItem } from './calling-api'

/** DB の role / roles から実効ロール一覧 */
export const effectiveRolesFromListItem = (u: UserListItem): string[] => {
  if (u.roles && u.roles.length > 0) return u.roles
  return [u.role]
}

const FLAG_EMOJI: Record<string, string> = {
  JP: '🇯🇵',
  US: '🇺🇸',
  GB: '🇬🇧',
  KR: '🇰🇷',
  CN: '🇨🇳',
  TW: '🇹🇼',
}

/** 国旗絵文字（未対応コードは地球アイコン相当の汎用表示） */
export const countryFlagEmoji = (code: string | null | undefined): string => {
  const c = (code ?? 'JP').trim().toUpperCase()
  return FLAG_EMOJI[c] ?? '🌏'
}

/** 住所一行：国旗 + 都道府県 */
export const formatMemberRegion = (u: UserListItem): string => {
  const flag = countryFlagEmoji(u.countryCode)
  const pref = (u.prefecture ?? '').trim()
  return pref.length > 0 ? `${flag} ${pref}` : `${flag} 未設定`
}
