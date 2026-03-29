import { describe, it, expect } from 'vitest'
import { sortAppointmentMaterialRows } from './sort-appointment-material-rows'
import type { DirectorRequestRow } from './types'

const baseRow = (over: Partial<DirectorRequestRow>): DirectorRequestRow => ({
  id: 'x',
  type: 'appointment',
  resultCapturedAt: '2026-01-01T00:00:00.000Z',
  companyName: 'A',
  targetUrl: 'https://a.example',
  memo: '',
  createdByUserId: 'u1',
  isRead: true,
  directorReadAt: null,
  ...over,
})

describe('sortAppointmentMaterialRows', () => {
  it('sorts by companyName ascending', () => {
    const rows = [baseRow({ id: '1', companyName: 'Zeta' }), baseRow({ id: '2', companyName: 'Alpha' })]
    const out = sortAppointmentMaterialRows(rows, 'companyName', 'asc')
    expect(out.map((r) => r.companyName)).toEqual(['Alpha', 'Zeta'])
  })

  it('sorts by resultCapturedAt descending', () => {
    const rows = [
      baseRow({ id: '1', resultCapturedAt: '2026-01-01T00:00:00.000Z' }),
      baseRow({ id: '2', resultCapturedAt: '2026-06-01T00:00:00.000Z' }),
    ]
    const out = sortAppointmentMaterialRows(rows, 'resultCapturedAt', 'desc')
    expect(out.map((r) => r.id)).toEqual(['2', '1'])
  })
})
