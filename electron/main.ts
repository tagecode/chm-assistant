import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, shell } from 'electron'
import Store from 'electron-store'

import { registerChmProtocol } from './chm-protocol'
import {
  closeChmSession,
  closeAllChmSessions,
  openChmSession,
  readChmPagePlainText,
} from './chm-reader-service'
import { searchChmSessionAsync } from './chm-search'
import { getCompilerStatus } from './compiler-resolve'
import { resolveProjectChmOutputPath } from './chm-build/compile-project'
import { createProjectInDirectory } from './project-bootstrap'
import {
  buildMarkdownPreviewHtml,
  compileProjectWithProgress,
  createMarkdownPage,
  createProjectFolder,
  deleteProjectTocNode,
  moveProjectTocNode,
  importProjectResources,
  listAssets,
  loadProject,
  readProjectMarkdown,
  refreshProjectToc,
  renameProjectTocNode,
  saveProject,
  writeProjectMarkdown,
} from './project-service'
import type { ChmProjectConfig, CompileLogLine, TocMovePlacement } from '../src/shared/project'
import { storeDefaults, type PersistedState } from './store-schema'
import type {
  LocaleMode,
  RecentEntry,
  ThemeMode,
  WorkspaceSession,
} from '../src/shared/electron'
import { clampRecentMaxCount } from '../src/shared/recent'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rendererDistPath = path.join(__dirname, '../dist/index.html')

function resolveWindowIcon(): string | undefined {
  const candidates = [
    path.join(__dirname, '../build/icon.png'),
    path.join(process.cwd(), 'build/icon.png'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return undefined
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'chm',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

const settingsStore = new Store<PersistedState>({
  name: 'chm-assistant',
  defaults: storeDefaults,
})

let mainWindow: BrowserWindow | null = null
const chmSearchAbortBySession = new Map<string, AbortController>()

function getRecentMaxCount(): number {
  return clampRecentMaxCount(settingsStore.get('recentMaxCount'))
}

function trimRecentList(max = getRecentMaxCount()): void {
  const recent = settingsStore.get('recent')
  if (recent.length > max) {
    settingsStore.set('recent', recent.slice(0, max))
  }
}

function pushRecent(entry: Omit<RecentEntry, 'openedAt'>): RecentEntry[] {
  const recent = [...settingsStore.get('recent')]
  const next = recent.filter(
    (item) => !(item.path === entry.path && item.type === entry.type),
  )
  next.unshift({ ...entry, openedAt: Date.now() })
  settingsStore.set('recent', next.slice(0, getRecentMaxCount()))
  return settingsStore.get('recent')
}

function sendMenuOpenChm() {
  mainWindow?.webContents.send('menu:open-chm')
}

function buildApplicationMenu() {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: '文件',
      submenu: [
        {
          label: '打开 CHM…',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuOpenChm(),
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1040,
    minHeight: 720,
    title: 'CHM Assistant',
    icon: resolveWindowIcon(),
    autoHideMenuBar: false,
    backgroundColor: '#2a1f18',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow = window

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL)
    window.webContents.openDevTools({ mode: 'detach' })
    return window
  }

  void window.loadFile(rendererDistPath)
  return window
}

function registerIpcHandlers() {
  ipcMain.handle('app:get-metadata', () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
  }))

  ipcMain.handle('settings:get', () => ({
    theme: settingsStore.get('theme'),
    locale: settingsStore.get('locale'),
    readerEncoding: settingsStore.get('readerEncoding'),
    chmCompilerPath: settingsStore.get('chmCompilerPath') ?? '',
    recentMaxCount: getRecentMaxCount(),
  }))

  ipcMain.handle('settings:set-theme', (_event, theme: ThemeMode) => {
    settingsStore.set('theme', theme)
    return theme
  })

  ipcMain.handle('settings:set-locale', (_event, locale: LocaleMode) => {
    settingsStore.set('locale', locale)
    return locale
  })

  ipcMain.handle('settings:set-reader-encoding', (_event, encoding: string) => {
    settingsStore.set('readerEncoding', encoding)
    return encoding
  })

  ipcMain.handle('settings:set-chm-compiler-path', (_event, compilerPath: string) => {
    settingsStore.set('chmCompilerPath', compilerPath)
    return compilerPath
  })

  ipcMain.handle('settings:set-recent-max-count', (_event, count: number) => {
    const next = clampRecentMaxCount(count)
    settingsStore.set('recentMaxCount', next)
    trimRecentList(next)
    return next
  })

  ipcMain.handle('compiler:get-status', () =>
    getCompilerStatus(settingsStore.get('chmCompilerPath') || null),
  )

  ipcMain.handle('shell:open-external', (_event, url: string) => {
    void shell.openExternal(url)
  })

  ipcMain.handle('dialog:pick-compiler', async (event) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow()
    if (!win) {
      return null
    }
    const isWin = process.platform === 'win32'
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: isWin ? '选择 hhc.exe' : '选择 chmcmd',
      properties: ['openFile'],
      filters: isWin
        ? [{ name: 'HTML Help Compiler', extensions: ['exe'] }]
        : [{ name: 'chmcmd', extensions: ['*'] }],
    })
    if (canceled || filePaths.length === 0) {
      return null
    }
    return filePaths[0] ?? null
  })

  ipcMain.handle('recent:get', () => {
    trimRecentList()
    return settingsStore.get('recent')
  })

  ipcMain.handle(
    'recent:add',
    (_event, entry: Omit<RecentEntry, 'openedAt'>) => pushRecent(entry),
  )

  ipcMain.handle('recent:clear', () => {
    settingsStore.set('recent', [])
  })

  ipcMain.handle('workspace:get', () => settingsStore.get('workspace'))

  ipcMain.handle('workspace:set', (_event, session: WorkspaceSession | null) => {
    settingsStore.set('workspace', session)
  })

  ipcMain.handle('dialog:open-chm', async (event) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow()
    if (!win) {
      return null
    }
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: '打开 CHM',
      properties: ['openFile'],
      filters: [{ name: 'CHM', extensions: ['chm'] }],
    })
    if (canceled || filePaths.length === 0) {
      return null
    }
    return filePaths[0] ?? null
  })

  ipcMain.handle('dialog:open-project', async (event) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow()
    if (!win) {
      return null
    }
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: '打开创作项目目录',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (canceled || filePaths.length === 0) {
      return null
    }
    return filePaths[0] ?? null
  })

  ipcMain.handle(
    'project:create',
    (_event, payload: { rootPath: string; title: string }) => {
      const result = createProjectInDirectory(payload.rootPath, payload.title)
      if (!result.ok) {
        return result
      }
      return { ok: true as const }
    },
  )

  ipcMain.handle('chm:open-session', (_event, filePath: string) =>
    openChmSession(filePath, settingsStore.get('readerEncoding')),
  )

  ipcMain.handle('chm:close-session', (_event, sessionId: string) => {
    chmSearchAbortBySession.get(sessionId)?.abort()
    chmSearchAbortBySession.delete(sessionId)
    closeChmSession(sessionId)
  })

  ipcMain.handle('chm:search', async (_event, sessionId: string, query: string) => {
    chmSearchAbortBySession.get(sessionId)?.abort()
    const ac = new AbortController()
    chmSearchAbortBySession.set(sessionId, ac)
    try {
      return await searchChmSessionAsync(sessionId, query, settingsStore.get('readerEncoding'), {
        signal: ac.signal,
      })
    } finally {
      if (chmSearchAbortBySession.get(sessionId) === ac) {
        chmSearchAbortBySession.delete(sessionId)
      }
    }
  })

  ipcMain.handle(
    'chm:plain-text',
    (_event, payload: { sessionId: string; internalPath: string }) =>
      readChmPagePlainText(
        payload.sessionId,
        payload.internalPath,
        settingsStore.get('readerEncoding'),
      ),
  )

  ipcMain.handle('app:open-notices', async () => {
    const candidates = [
      path.join(app.getAppPath(), 'dist', 'NOTICES.md'),
      path.join(app.getAppPath(), 'public', 'NOTICES.md'),
    ]
    const noticesPath = candidates.find((p) => fs.existsSync(p))
    if (!noticesPath) {
      return { ok: false as const, message: 'NOTICES.md not found' }
    }
    const err = await shell.openPath(noticesPath)
    if (err) {
      return { ok: false as const, message: err }
    }
    return { ok: true as const, path: noticesPath }
  })

  ipcMain.handle('project:load', (_event, rootPath: string) => loadProject(rootPath))

  ipcMain.handle(
    'project:save-config',
    (_event, payload: { rootPath: string; config: ChmProjectConfig }) =>
      saveProject(payload.rootPath, payload.config),
  )

  ipcMain.handle(
    'project:read-md',
    (_event, payload: { rootPath: string; mdPath: string }) =>
      readProjectMarkdown(payload.rootPath, payload.mdPath),
  )

  ipcMain.handle(
    'project:write-md',
    (_event, payload: { rootPath: string; mdPath: string; content: string }) =>
      writeProjectMarkdown(payload.rootPath, payload.mdPath, payload.content),
  )

  ipcMain.handle(
    'project:create-page',
    (
      _event,
      payload: {
        rootPath: string
        config: ChmProjectConfig
        title: string
        mdPath?: string
        contextNodeId?: string | null
      },
    ) =>
      createMarkdownPage(
        payload.rootPath,
        payload.config,
        payload.title,
        payload.mdPath,
        payload.contextNodeId,
      ),
  )

  ipcMain.handle(
    'project:create-folder',
    (
      _event,
      payload: {
        rootPath: string
        config: ChmProjectConfig
        folderName: string
        contextNodeId?: string | null
      },
    ) =>
      createProjectFolder(
        payload.rootPath,
        payload.config,
        payload.folderName,
        payload.contextNodeId,
      ),
  )

  ipcMain.handle(
    'project:refresh-toc',
    (_event, payload: { rootPath: string; config: ChmProjectConfig }) => {
      const next = refreshProjectToc(payload.rootPath, payload.config)
      return { ok: true as const, config: next }
    },
  )

  ipcMain.handle(
    'project:rename-toc-node',
    (
      _event,
      payload: {
        rootPath: string
        config: ChmProjectConfig
        nodeId: string
        title: string
        mdPath?: string
        dirName?: string
      },
    ) =>
      renameProjectTocNode(
        payload.rootPath,
        payload.config,
        payload.nodeId,
        payload.title,
        payload.mdPath,
        payload.dirName,
      ),
  )

  ipcMain.handle(
    'project:delete-toc-node',
    (
      _event,
      payload: { rootPath: string; config: ChmProjectConfig; nodeId: string },
    ) => deleteProjectTocNode(payload.rootPath, payload.config, payload.nodeId),
  )

  ipcMain.handle(
    'project:move-toc-node',
    (
      _event,
      payload: {
        rootPath: string
        config: ChmProjectConfig
        nodeId: string
        placement: TocMovePlacement
      },
    ) =>
      moveProjectTocNode(
        payload.rootPath,
        payload.config,
        payload.nodeId,
        payload.placement,
      ),
  )

  ipcMain.handle(
    'project:compile',
    async (event, payload: { rootPath: string; config: ChmProjectConfig }) => {
      const sender = event.sender
      const chmPath = resolveProjectChmOutputPath(payload.rootPath, payload.config)
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('chm:close-for-path', chmPath)
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 150))

      const onProgress = (line: CompileLogLine) => {
        sender.send('project:compile-log', line)
      }
      const compilerPath = settingsStore.get('chmCompilerPath') || null
      return compileProjectWithProgress(
        payload.rootPath,
        payload.config,
        compilerPath,
        onProgress,
      )
    },
  )

  ipcMain.handle(
    'project:preview-html',
    (
      _event,
      payload: { rootPath: string; mdPath: string; content: string },
    ) => buildMarkdownPreviewHtml(payload.rootPath, payload.mdPath, payload.content),
  )

  ipcMain.handle(
    'project:import-resources',
    (
      _event,
      payload: { rootPath: string; config: ChmProjectConfig; sourcePaths: string[] },
    ) => importProjectResources(payload.rootPath, payload.config, payload.sourcePaths),
  )

  ipcMain.handle(
    'project:list-assets',
    (_event, payload: { rootPath: string; config: ChmProjectConfig }) =>
      listAssets(payload.rootPath, payload.config),
  )

  ipcMain.handle('dialog:import-resources', async (event) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow()
    if (!win) {
      return [] as string[]
    }
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: '导入资源',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Images & files',
          extensions: [
            'png',
            'jpg',
            'jpeg',
            'gif',
            'webp',
            'svg',
            'bmp',
            'pdf',
            'zip',
          ],
        },
        { name: 'All', extensions: ['*'] },
      ],
    })
    if (canceled) {
      return []
    }
    return filePaths
  })
}

app.whenReady().then(() => {
  registerChmProtocol(() => settingsStore.get('readerEncoding'))
  registerIpcHandlers()
  buildApplicationMenu()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('before-quit', () => {
  closeAllChmSessions()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
