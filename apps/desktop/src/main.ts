import { BrowserWindow, app, shell } from 'electron'
import path from 'path'

const WEB_URL = process.env.IS_CRM_WEB_URL ?? 'http://localhost:3000'

const isExternalProtocol = (url: string): boolean => {
  const trimmed = url.trim()
  if (trimmed.startsWith('tel:')) return true
  if (trimmed.startsWith('zoommtg:')) return true
  if (trimmed.startsWith('https://zoom.us/')) return true
  if (trimmed.startsWith('https://us02web.zoom.us/')) return true
  if (trimmed.startsWith('https://us04web.zoom.us/')) return true
  return false
}

const createMainWindow = async (): Promise<BrowserWindow> => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalProtocol(url)) {
      void shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (isExternalProtocol(url)) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  await win.loadURL(`${WEB_URL}/sales-room/v2`)
  return win
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow()
  }
})

app.whenReady().then(() => {
  void createMainWindow()
})

