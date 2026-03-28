import { describe, expect, it } from 'vitest'
import { CALLING_RESULT_VALUES } from './calling-result-canonical'
import { SALES_ROOM_RESULT_OPTIONS, matchSalesRoomActionValueFromLabel } from './sales-room-result-options'

describe('SALES_ROOM_RESULT_OPTIONS', () => {
  it('lists 10 canonical results in fixed order', () => {
    const values = SALES_ROOM_RESULT_OPTIONS.map((o) => o.value)
    expect(values).toEqual([...CALLING_RESULT_VALUES])
  })
})

describe('matchSalesRoomActionValueFromLabel', () => {
  it('maps legacy DB values to canonical names', () => {
    expect(matchSalesRoomActionValueFromLabel('担当者あり興味')).toBe('再架電')
    expect(matchSalesRoomActionValueFromLabel('担当者あり不要')).toBe('担当NG')
    expect(matchSalesRoomActionValueFromLabel('断り')).toBe('受付NG')
    expect(matchSalesRoomActionValueFromLabel('留守電メモ')).toBe('未着電')
  })

  it('accepts canonical names as-is', () => {
    expect(matchSalesRoomActionValueFromLabel('再架電')).toBe('再架電')
    expect(matchSalesRoomActionValueFromLabel('受付NG')).toBe('受付NG')
  })

  it('maps display label 自動対応NG to 折り返し依頼', () => {
    expect(matchSalesRoomActionValueFromLabel('自動対応NG')).toBe('折り返し依頼')
  })
})
