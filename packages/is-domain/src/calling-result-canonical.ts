/**
 * 架電結果の正規名（DB・API・UI 共通の SSOT）。10種固定。
 * 「留守電」は未着電と同義のため正規名から除外し、読み取り時は未着電に正規化する。
 */
export const CALLING_RESULT_VALUES = [
  'アポ',
  '資料送付',
  '再架電',
  '折り返し依頼',
  '担当NG',
  '受付NG',
  '不在',
  '未着電',
  'クレーム',
  '番号違い',
] as const

export type CallingResultType = (typeof CALLING_RESULT_VALUES)[number]

const LEGACY_TO_CANONICAL: Record<string, CallingResultType> = {
  担当者あり興味: '再架電',
  担当者あり不要: '担当NG',
  断り: '受付NG',
}

/**
 * DB や API から読んだ文字列を正規名に揃える（旧名・別名を吸収）。
 */
export function normalizeCallingResult(raw: string): CallingResultType {
  const t = raw.trim()
  if ((CALLING_RESULT_VALUES as readonly string[]).includes(t)) {
    return t as CallingResultType
  }
  const mapped = LEGACY_TO_CANONICAL[t]
  if (mapped) return mapped
  if (t === 'リスト除外') return '受付NG'
  if (t === '不通' || t === '留守電') return '未着電'
  return '不在'
}
