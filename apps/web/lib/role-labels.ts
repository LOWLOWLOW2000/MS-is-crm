import type { UserRole } from './types'

/** ヘッダー「役職」行用（ユーザー向け表記） */
const HEADER_ROLE_LABEL: Record<UserRole, string> = {
  developer: '開発者',
  enterprise_admin: '企業アカウント管理者',
  is_admin: 'IS 管理者',
  director: 'ディレクター',
  is_member: 'IS',
}

/** 表示順：ディレクター → IS系 → 企業アカウント管理者 → 開発者 */
const HEADER_ROLE_ORDER: UserRole[] = [
  'director',
  'is_member',
  'is_admin',
  'enterprise_admin',
  'developer',
]

/** ヘッダー用。例: ディレクター・企業アカウント管理者 */
export const formatHeaderRolesJa = (roles: UserRole[]): string => {
  const unique = [...new Set(roles)]
  unique.sort((a, b) => HEADER_ROLE_ORDER.indexOf(a) - HEADER_ROLE_ORDER.indexOf(b))
  return unique.map((r) => HEADER_ROLE_LABEL[r] ?? r).join('・')
}

const ROLE_LABEL_JA: Record<UserRole, string> = {
  developer: '開発者',
  enterprise_admin: '企業アカウント管理者',
  is_admin: 'IS 管理者',
  director: 'ディレクター',
  is_member: 'IS',
}

const ROLE_ORDER: UserRole[] = [
  'developer',
  'enterprise_admin',
  'is_admin',
  'director',
  'is_member',
]

/** 複数ロールを「・」で連結（権限の強い順。汎用） */
export const formatRolesJa = (roles: UserRole[]): string => {
  const unique = [...new Set(roles)]
  unique.sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b))
  return unique.map((r) => ROLE_LABEL_JA[r] ?? r).join('・')
}
