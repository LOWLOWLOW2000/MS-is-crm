import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type MaterialRequestStatus = 'draft' | 'sent' | 'returned' | 'deleted' | 'failed'

export interface MaterialRequestItem {
  id: string
  tenantId: string
  slug: string
  companyName: string
  status: MaterialRequestStatus
  isUnreadForIs: boolean
  /** 差し戻し理由（returned のときのみ想定） */
  returnReason?: string | null
  required: {
    deliveryMethod: string | null
    materialSet: string | null
  }
  freeMemo: string
  createdAt: number
  updatedAt: number
}

interface MaterialRequestState {
  items: MaterialRequestItem[]
  markRead: (id: string) => void
  upsert: (item: Omit<MaterialRequestItem, 'updatedAt'> & { updatedAt?: number }) => void
  remove: (id: string) => void
}

const makeId = (): string => `material-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const useMaterialRequestStore = create<MaterialRequestState>()(
  persist(
    (set) => ({
      items: [],
      markRead: (id) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, isUnreadForIs: false, updatedAt: Date.now() } : i)),
        })),
      upsert: (item) =>
        set((state) => {
          const now = Date.now()
          const nextUpdatedAt = item.updatedAt ?? now
          const id = item.id || makeId()
          const next: MaterialRequestItem = { ...item, id, updatedAt: nextUpdatedAt }
          const exists = state.items.some((i) => i.id === id)
          return exists ? { items: state.items.map((i) => (i.id === id ? next : i)) } : { items: [next, ...state.items] }
        }),
      remove: (id) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, status: 'deleted', updatedAt: Date.now() } : i)),
        })),
    }),
    { name: 'material-request-v1' },
  ),
)

