/**
 * 架電コックピットの部署TEL・担当の重複判定用（正規化と照合）。
 */

export const normalizePhoneDigits = (raw: string): string => raw.replace(/\D/g, '')

export const normalizeDeptLabel = (raw: string): string => raw.trim().toLowerCase()

export interface DeptPhoneRow {
  label: string
  phone: string
}

export interface PersonaPhoneRow {
  name: string
  phone: string
  department: string
}

/**
 * 部署代表TEL の重複を返す（電話の数字一致、または部署名の正規化一致）。
 */
export function findDeptDuplicate(
  candidate: { label: string; phone: string },
  existing: DeptPhoneRow[],
  excludeNormalizedPhone?: string,
): string | null {
  const candPhone = normalizePhoneDigits(candidate.phone)
  const candLabel = normalizeDeptLabel(candidate.label)
  if (!candPhone && !candLabel) return null

  for (const row of existing) {
    const exPhone = normalizePhoneDigits(row.phone)
    const exLabel = normalizeDeptLabel(row.label)
    if (excludeNormalizedPhone && exPhone === excludeNormalizedPhone) continue
    if (candPhone && exPhone && candPhone === exPhone) {
      return `電話番号が既に登録されています（${row.label}）`
    }
    if (candLabel && exLabel && candLabel === exLabel && candLabel.length > 0) {
      return `部署名が既に登録されています（${row.phone ? row.phone : '代表TEL なし'}）`
    }
  }
  return null
}

/**
 * 担当の直通TEL または 氏名＋部署 の重複を返す。
 */
export function findPersonaDuplicate(
  candidate: { name: string; phone: string; department: string },
  existing: PersonaPhoneRow[],
): string | null {
  const candPhone = normalizePhoneDigits(candidate.phone)
  const candName = candidate.name.trim().toLowerCase()
  const candDept = candidate.department.trim().toLowerCase()

  for (const row of existing) {
    const exPhone = normalizePhoneDigits(row.phone)
    if (candPhone && exPhone && candPhone === exPhone) {
      return `担当の直通電話が既に登録されています（${row.department} ${row.name}）`
    }
    if (
      candName &&
      row.name.trim().toLowerCase() === candName &&
      candDept &&
      row.department.trim().toLowerCase() === candDept
    ) {
      return `同一部署・同名の担当が既にいます（${row.phone || 'TEL なし'}）`
    }
  }
  return null
}

/**
 * draft 支店・施設行同士の代表TEL 重複（同一 draft 内）。
 */
export function findDuplicateEstablishmentPhones(
  rows: { name: string; phone: string }[],
): string | null {
  const seen = new Map<string, string>()
  for (const row of rows) {
    const d = normalizePhoneDigits(row.phone)
    if (!d) continue
    const prev = seen.get(d)
    if (prev) {
      return `代表TEL「${row.phone}」が ${prev} と ${row.name || '（名称なし）'} で重複しています`
    }
    seen.set(d, row.name.trim() || row.phone)
  }
  return null
}
