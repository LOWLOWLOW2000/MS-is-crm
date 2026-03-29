import type { ReportingFormatDefinitionRow } from './types'

/** API `ReportingFormatDefinition.kind` と一致 */
export const REPORTING_SCHEMA_KINDS = ['common_header', 'appointment', 'material_request'] as const
export type ReportingSchemaKind = (typeof REPORTING_SCHEMA_KINDS)[number]

/**
 * schema_json.fields の1要素（架電ルーム・ディレクター編集の共通形）
 */
export interface ReportingSchemaField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select'
  required?: boolean
  /** type が select のときの候補 */
  options?: string[]
}

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

/**
 * schemaJson から fields 配列を取り出し検証する
 */
export function parseReportingSchemaFields(schemaJson: Record<string, unknown>): ReportingSchemaField[] {
  const raw = schemaJson.fields
  if (!Array.isArray(raw)) return []
  return raw
    .map((item): ReportingSchemaField | null => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) return null
      const o = item as Record<string, unknown>
      if (!isNonEmptyString(o.id) || !isNonEmptyString(o.label)) return null
      const t = o.type
      const type: ReportingSchemaField['type'] =
        t === 'textarea' || t === 'select' || t === 'text' ? t : 'text'
      const options = Array.isArray(o.options)
        ? o.options.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : []
      return {
        id: o.id.trim(),
        label: o.label.trim(),
        type,
        required: o.required === true,
        options: type === 'select' && options.length > 0 ? options : undefined,
      }
    })
    .filter((x): x is ReportingSchemaField => x !== null)
}

/**
 * 行動結果に応じてマージするフォーマット種別（先に common、次に専用）
 */
export function reportingKindsForResult(action: string): readonly ReportingSchemaKind[] {
  if (action === 'アポ') return ['common_header', 'appointment']
  if (action === '資料送付') return ['common_header', 'material_request']
  return ['common_header']
}

/**
 * 同一 id は先勝ち（共通ヘッダを優先）
 */
export function mergedFieldsForAction(
  formats: ReportingFormatDefinitionRow[],
  action: string,
): ReportingSchemaField[] {
  const kinds = reportingKindsForResult(action)
  const byKind = new Map(formats.map((f) => [f.kind, f.schemaJson]))
  const seen = new Set<string>()
  const out: ReportingSchemaField[] = []
  for (const kind of kinds) {
    const schema = byKind.get(kind)
    if (!schema) continue
    for (const field of parseReportingSchemaFields(schema)) {
      if (seen.has(field.id)) continue
      seen.add(field.id)
      out.push(field)
    }
  }
  return out
}

/**
 * 入力値から structuredReport 用オブジェクトを組み立てる（空は省略）
 */
export function buildStructuredReportFromFieldValues(
  fields: ReportingSchemaField[],
  values: Record<string, string>,
): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const v = values[f.id]?.trim() ?? ''
    if (v.length > 0) out[f.id] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * メモ本文に載せる1行要約用（ラベル：値）
 */
export function formatStructuredLinesForMemo(fields: ReportingSchemaField[], values: Record<string, string>): string[] {
  return fields
    .map((f) => {
      const v = values[f.id]?.trim() ?? ''
      return v.length > 0 ? `${f.label}：${v}` : ''
    })
    .filter((line) => line.length > 0)
}
