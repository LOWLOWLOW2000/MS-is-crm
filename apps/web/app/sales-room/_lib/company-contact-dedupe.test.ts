import { describe, expect, it } from 'vitest'
import {
  findDeptDuplicate,
  findDuplicateEstablishmentPhones,
  findPersonaDuplicate,
  normalizePhoneDigits,
} from './company-contact-dedupe'

describe('normalizePhoneDigits', () => {
  it('数字以外を除去する', () => {
    expect(normalizePhoneDigits('03-1234-5678')).toBe('0312345678')
  })
})

describe('findDeptDuplicate', () => {
  it('同一電話で重複を検出する', () => {
    const msg = findDeptDuplicate(
      { label: '新規', phone: '03-1234-5000' },
      [{ label: '本社', phone: '03-1234-5000' }],
    )
    expect(msg).toContain('電話番号が既に')
  })

  it('同一部署名で重複を検出する', () => {
    const msg = findDeptDuplicate(
      { label: '  本社  ', phone: '090-0000-0000' },
      [{ label: '本社', phone: '03-1' }],
    )
    expect(msg).toContain('部署名が既に')
  })
})

describe('findPersonaDuplicate', () => {
  it('同一直通電話で重複を検出する', () => {
    const msg = findPersonaDuplicate(
      { name: '別名', phone: '03-9999-9999', department: '営業' },
      [{ name: '山田', phone: '03-9999-9999', department: '営業' }],
    )
    expect(msg).toContain('直通電話')
  })
})

describe('findDuplicateEstablishmentPhones', () => {
  it('draft 内の代表TEL 重複を検出する', () => {
    const msg = findDuplicateEstablishmentPhones([
      { name: 'A', phone: '03-1234-5000' },
      { name: 'B', phone: '0312345000' },
    ])
    expect(msg).toContain('重複')
  })
})
