import type { CallingResultType } from './calling-result-canonical'
import { CALLING_RESULT_UI_ROWS } from './sales-room-calling-result-ui'

/**
 * 保有リスト（★架電ルームの架電結果と同一。配布画面の架電結果チェックと整合）
 */
export interface HoldListEntry {
  id: string
  label: string
  /** このリストに含める架電結果（DB 正規名） */
  resultValues: CallingResultType[]
}

export const DEFAULT_HOLD_LIST_ENTRIES: HoldListEntry[] = CALLING_RESULT_UI_ROWS.map((r) => ({
  id: r.id,
  label: r.label,
  resultValues: [r.resultValue],
}))

export const DEFAULT_HOLD_LIST_ID = DEFAULT_HOLD_LIST_ENTRIES[0]?.id ?? 'appo'

/**
 * 次回ACT（次回架電など）の昇順。未設定は末尾。
 */
export function compareByNextActAt(
  a: { nextActAt?: string | null },
  b: { nextActAt?: string | null },
): number {
  const ta = a.nextActAt ? new Date(a.nextActAt).getTime() : Number.POSITIVE_INFINITY
  const tb = b.nextActAt ? new Date(b.nextActAt).getTime() : Number.POSITIVE_INFINITY
  if (Number.isNaN(ta) && Number.isNaN(tb)) return 0
  if (Number.isNaN(ta)) return 1
  if (Number.isNaN(tb)) return -1
  return ta - tb
}
