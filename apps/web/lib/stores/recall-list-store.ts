import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface RecallListItem {
  id: string
  companyName: string
  /** 架電予定日時（ms）。時間が近づくとリストバー点滅・AIリマインド。 */
  scheduledAt: number
  /** 営業ルーム等への直リンク */
  pageLink: string
  createdAt: number
}

interface RecallListState {
  items: RecallListItem[]
  add: (item: Omit<RecallListItem, 'id' | 'createdAt'>) => void
  remove: (id: string) => void
  /** 指定分数以内の予定を取得（3分前・1分前のリマインド用） */
  getWithinMinutes: (minutes: number) => RecallListItem[]
}

export const useRecallListStore = create<RecallListState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) =>
        set((state) => ({
          items: [
            ...state.items,
            {
              ...item,
              id: `recall-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              createdAt: Date.now(),
            },
          ].sort((a, b) => a.scheduledAt - b.scheduledAt),
        })),
      remove: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        })),
      getWithinMinutes: (minutes) => {
        const now = Date.now()
        const from = now
        const to = now + minutes * 60 * 1000
        return get().items.filter((i) => i.scheduledAt >= from && i.scheduledAt <= to)
      },
    }),
    { name: 'recall-list-v1' }
  )
)
