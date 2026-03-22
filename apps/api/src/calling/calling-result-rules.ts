/**
 * 架電結果の集計・配布/KPI用ルール（プラン「ト書き」準拠）
 */

/** 汎用結果タイプ（calling-record.entity と整合） */
export const ALL_CALLING_RESULTS = [
  '担当者あり興味',
  '担当者あり不要',
  '不在',
  '番号違い',
  '断り',
  '折り返し依頼',
  '留守電',
  '資料送付',
  'アポ',
  'リスト除外',
  '不通',
] as const

/** 「不在」以外の結果フラグ（同一扱いの母集団に含める用） */
export const CALLING_RESULTS_EXCEPT_ABSENT = ALL_CALLING_RESULTS.filter((r) => r !== '不在')

const VOICEMAIL_OR_UNREACHABLE = new Set<string>(['留守電', '不通'])

/** 留守電・不通の件数 */
export const countVoicemailAndUnreachable = (records: { result: string }[]): number =>
  records.reduce((n, r) => n + (VOICEMAIL_OR_UNREACHABLE.has(r.result) ? 1 : 0), 0)

/** 留守電+不通がこの回数以上なら「相手が受電した」相当として扱う */
export const VOICEMAIL_UNREACHABLE_ANSWERED_THRESHOLD = 4

export const voicemailUnreachableIndicatesAnswered = (count: number): boolean =>
  count >= VOICEMAIL_UNREACHABLE_ANSWERED_THRESHOLD

/**
 * 同一架電先キー（targetUrl + phone）ごとに、直接接続に相当する件数を推計する。
 * - 担当者あり興味/不要 は1件ごとに接続扱い
 * - 上記が無く留守電+不通が閾値以上のグループは接続1件として加算
 */
export const effectiveConnectionCountForRecords = (
  records: { result: string; targetUrl: string; companyPhone: string }[],
): number => {
  const byKey = new Map<string, { result: string; targetUrl: string; companyPhone: string }[]>()
  for (const r of records) {
    const key = `${r.targetUrl}\u0000${r.companyPhone}`
    const list = byKey.get(key) ?? []
    list.push(r)
    byKey.set(key, list)
  }
  let total = 0
  for (const group of byKey.values()) {
    const direct = group.filter(
      (r) => r.result === '担当者あり興味' || r.result === '担当者あり不要',
    ).length
    if (direct > 0) {
      total += direct
      continue
    }
    const vmUr = countVoicemailAndUnreachable(group)
    if (voicemailUnreachableIndicatesAnswered(vmUr)) {
      total += 1
    }
  }
  return total
}
