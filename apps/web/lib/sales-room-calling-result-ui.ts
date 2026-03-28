import { CALLING_RESULT_VALUES, type CallingResultType } from './calling-result-canonical'

/**
 * 画面上の表示ラベル（value / DB 正規名は変えない）
 */
export function callingResultDisplayLabel(result: CallingResultType): string {
  if (result === '折り返し依頼') return '自動対応NG'
  return result
}

/** 保有リスト左セレクト用（正規名1件＝1行。id は URL クエリ `list=` 用スラッグ） */
export interface CallingResultUiRow {
  id: string
  label: string
  resultValue: CallingResultType
}

/** `CALLING_RESULT_VALUES` と同じ並びのスラッグ（`list` パラメータ） */
const CALLING_RESULT_ROW_SLUGS = [
  'appo',
  'material',
  'recall',
  'callback',
  'staff_ng',
  'reception_ng',
  'absent',
  'no_answer',
  'claim',
  'wrong_number',
] as const

export const CALLING_RESULT_UI_ROWS: CallingResultUiRow[] = CALLING_RESULT_VALUES.map((resultValue, i) => ({
  id: CALLING_RESULT_ROW_SLUGS[i] ?? `result_${i}`,
  label: callingResultDisplayLabel(resultValue),
  resultValue,
}))

/** 正規名 → 左セレクト・URL 用スラッグ（DB には保存しない） */
export const CALLING_RESULT_SLUG_BY_VALUE = Object.fromEntries(
  CALLING_RESULT_UI_ROWS.map((r) => [r.resultValue, r.id]),
) as Record<CallingResultType, string>

/**
 * 架電結果の表示トーン（営業ルーム左リスト・行動結果パネルで共通）
 * - 赤: アポ
 * - 青: 資料送付・再架電
 * - 緑: 不在・未着電
 * - neutral（グレー系）: 担当NG・受付NG・折り返し依頼・クレーム・番号違い など
 */
export type CallingResultUiTone = 'red' | 'blue' | 'green' | 'neutral'

export function callingResultUiTone(
  result: CallingResultType | string | null | undefined,
): CallingResultUiTone {
  if (result == null || result === '') return 'neutral'
  switch (result) {
    case 'アポ':
      return 'red'
    case '資料送付':
    case '再架電':
      return 'blue'
    case '不在':
    case '未着電':
      return 'green'
    default:
      return 'neutral'
  }
}

/** 左リスト・小バッジ用（枠付き pill） */
export function callingResultCompactBadgeClasses(
  result: CallingResultType | string | null | undefined,
): string {
  const t = callingResultUiTone(result)
  switch (t) {
    case 'red':
      return 'border-red-300 bg-red-50 text-red-900'
    case 'blue':
      return 'border-blue-300 bg-blue-50 text-blue-900'
    case 'green':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900'
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700'
  }
}

/** 行動結果ラジオのラベル枠（1件ずつ色分け） */
export function callingResultRadioLabelClasses(value: CallingResultType): string {
  const t = callingResultUiTone(value)
  const base = 'rounded-md border px-2.5 py-1.5 transition-colors'
  switch (t) {
    case 'red':
      return `${base} border-red-300 bg-red-50/90 text-red-950 has-[:checked]:ring-2 has-[:checked]:ring-red-400`
    case 'blue':
      return `${base} border-blue-300 bg-blue-50/90 text-blue-950 has-[:checked]:ring-2 has-[:checked]:ring-blue-400`
    case 'green':
      return `${base} border-emerald-300 bg-emerald-50/90 text-emerald-950 has-[:checked]:ring-2 has-[:checked]:ring-emerald-400`
    default:
      return `${base} border-gray-300 bg-gray-50 text-gray-900 has-[:checked]:ring-2 has-[:checked]:ring-gray-400`
  }
}

/** スレッド aside の各行（左ボーダー＋背景） */
export function callingResultThreadRowClasses(actionResult: string): string {
  const t = callingResultUiTone(actionResult)
  switch (t) {
    case 'red':
      return 'border-l-4 border-l-red-500 bg-red-50/90'
    case 'blue':
      return 'border-l-4 border-l-blue-500 bg-blue-50/90'
    case 'green':
      return 'border-l-4 border-l-emerald-500 bg-emerald-50/90'
    default:
      return 'border-l-4 border-l-gray-400 bg-gray-50'
  }
}

/** スレッド本文の強調色（アポ赤などの互換をトーンに統一） */
export function callingResultThreadSummaryClasses(actionResult: string): string {
  const t = callingResultUiTone(actionResult)
  if (t === 'red') return 'break-words font-medium text-red-950'
  return 'break-words text-gray-800'
}
