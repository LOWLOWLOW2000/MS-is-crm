import type { DirectorRequestRow } from './types'

export type SortableAppointmentMaterialKey =
  | 'resultCapturedAt'
  | 'type'
  | 'companyName'
  | 'targetUrl'
  | 'memo'

/**
 * IS 向けアポ・資料テーブルのクライアントソート（元配列は変更しない）
 */
export function sortAppointmentMaterialRows(
  rows: DirectorRequestRow[],
  key: SortableAppointmentMaterialKey,
  dir: 'asc' | 'desc',
): DirectorRequestRow[] {
  const mult = dir === 'asc' ? 1 : -1
  const cell = (r: DirectorRequestRow): string => {
    switch (key) {
      case 'type':
        return r.type
      case 'resultCapturedAt':
        return r.resultCapturedAt
      case 'companyName':
        return r.companyName
      case 'targetUrl':
        return r.targetUrl
      case 'memo':
        return r.memo
      default:
        return ''
    }
  }
  return [...rows].sort((a, b) => {
    const cmp = cell(a).localeCompare(cell(b), 'ja', { numeric: true })
    if (cmp !== 0) return cmp * mult
    return a.id.localeCompare(b.id) * mult
  })
}
