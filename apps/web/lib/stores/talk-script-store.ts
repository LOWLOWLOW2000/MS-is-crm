import { create } from 'zustand'

export interface SelfTalkScriptTab {
  id: string
  title: string
  content: string
}

interface TalkScriptState {
  /** 自分で書くトークスクリプト（最大4枚までタブで保持） */
  selfTabs: SelfTalkScriptTab[]
  activeSelfTabId: string
  setActiveSelfTabId: (id: string) => void
  updateSelfTabContent: (id: string, content: string) => void
  addSelfTab: () => void
}

const createInitialTabs = (): SelfTalkScriptTab[] => [
  {
    id: 'self-1',
    title: '自分で書く1',
    content: '',
  },
]

export const useTalkScriptStore = create<TalkScriptState>((set, get) => ({
  selfTabs: createInitialTabs(),
  activeSelfTabId: 'self-1',
  setActiveSelfTabId: (id) => {
    const { selfTabs } = get()
    if (selfTabs.some((t) => t.id === id)) {
      set({ activeSelfTabId: id })
    }
  },
  updateSelfTabContent: (id, content) => {
    set((state) => ({
      selfTabs: state.selfTabs.map((tab) =>
        tab.id === id ? { ...tab, content } : tab
      ),
    }))
  },
  addSelfTab: () => {
    const { selfTabs } = get()
    if (selfTabs.length >= 4) return
    const nextIndex = selfTabs.length + 1
    const id = `self-${nextIndex}`
    const nextTab: SelfTalkScriptTab = {
      id,
      title: `自分で書く${nextIndex}`,
      content: '',
    }
    set({
      selfTabs: [...selfTabs, nextTab],
      activeSelfTabId: id,
    })
  },
}))


