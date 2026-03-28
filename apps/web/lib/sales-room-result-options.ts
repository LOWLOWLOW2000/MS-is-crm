import type { CallingResultType } from './calling-result-canonical'
import { CALLING_RESULT_VALUES, normalizeCallingResult } from './calling-result-canonical'
import { callingResultDisplayLabel } from './sales-room-calling-result-ui'

export interface SalesRoomResultOption {
  value: CallingResultType
  label: string
}

/**
 * 架電ルームの行動結果 10 種。value は DB・API と同一（正規名）。留守電は未着電に含める。
 */
export const SALES_ROOM_RESULT_OPTIONS: SalesRoomResultOption[] = CALLING_RESULT_VALUES.map((value) => ({
  value,
  label: callingResultDisplayLabel(value),
}))

/**
 * 表示ラベル・旧保存値・別名から正規名（DB 保存値）を復元する。
 */
export function matchSalesRoomActionValueFromLabel(actionResult: string): string {
  const t = actionResult.trim()
  if (t.includes('留守電')) return '未着電'
  if (t === '自動対応NG') return '折り返し依頼'
  const fromOptions = SALES_ROOM_RESULT_OPTIONS.find((o) => o.label === t || o.value === t)
  if (fromOptions) return fromOptions.value
  return normalizeCallingResult(t)
}
