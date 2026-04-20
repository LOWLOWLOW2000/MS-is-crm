import { contextBridge, shell } from 'electron'

/**
 * @public
 * Web（Next.js）から OS 連携を呼ぶための最小ブリッジ。
 */
contextBridge.exposeInMainWorld('isCrmDesktop', {
  openExternal: async (url: string): Promise<void> => {
    const trimmed = typeof url === 'string' ? url.trim() : ''
    if (!trimmed) return
    await shell.openExternal(trimmed)
  },
})

