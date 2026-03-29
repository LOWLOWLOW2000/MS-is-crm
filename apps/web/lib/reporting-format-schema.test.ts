import { describe, expect, it } from 'vitest'
import {
  buildStructuredReportFromFieldValues,
  mergedFieldsForAction,
  parseReportingSchemaFields,
  reportingKindsForResult,
} from './reporting-format-schema'
import type { ReportingFormatDefinitionRow } from './types'

describe('parseReportingSchemaFields', () => {
  it('空や不正な fields を除外する', () => {
    expect(parseReportingSchemaFields({})).toEqual([])
    expect(parseReportingSchemaFields({ fields: 'x' })).toEqual([])
    const ok = parseReportingSchemaFields({
      fields: [
        { id: 'a', label: 'A', type: 'text' },
        { id: '', label: 'B', type: 'text' },
        { id: 'c', label: '', type: 'text' },
      ],
    })
    expect(ok).toHaveLength(1)
    expect(ok[0]?.id).toBe('a')
  })
})

describe('mergedFieldsForAction', () => {
  const formats: ReportingFormatDefinitionRow[] = [
    {
      kind: 'common_header',
      schemaJson: { fields: [{ id: 'note', label: 'メモ', type: 'textarea' }] },
    },
    {
      kind: 'appointment',
      schemaJson: { fields: [{ id: 'meetingAt', label: '日時', type: 'text' }] },
    },
  ]

  it('アポでは共通を先にマージする', () => {
    const m = mergedFieldsForAction(formats, 'アポ')
    expect(m.map((f) => f.id)).toEqual(['note', 'meetingAt'])
  })

  it('重複 id は先勝ち', () => {
    const dup: ReportingFormatDefinitionRow[] = [
      {
        kind: 'common_header',
        schemaJson: { fields: [{ id: 'x', label: '先', type: 'text' }] },
      },
      {
        kind: 'appointment',
        schemaJson: { fields: [{ id: 'x', label: '後', type: 'text' }] },
      },
    ]
    const m = mergedFieldsForAction(dup, 'アポ')
    expect(m).toHaveLength(1)
    expect(m[0]?.label).toBe('先')
  })
})

describe('reportingKindsForResult', () => {
  it('資料送付で material_request を含む', () => {
    expect(reportingKindsForResult('資料送付')).toContain('material_request')
  })
})

describe('buildStructuredReportFromFieldValues', () => {
  it('空値は含めない', () => {
    const fields = [{ id: 'a', label: 'A', type: 'text' as const }]
    expect(buildStructuredReportFromFieldValues(fields, { a: '  ' })).toBeUndefined()
    expect(buildStructuredReportFromFieldValues(fields, { a: 'ok' })).toEqual({ a: 'ok' })
  })
})
