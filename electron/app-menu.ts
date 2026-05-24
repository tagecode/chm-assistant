import { app, BrowserWindow, Menu } from 'electron'

import type { LocaleMode } from '../src/shared/electron'

export type AppMenuAction =
  | 'new-project'
  | 'open-chm'
  | 'open-project'
  | 'go-home'
  | 'settings'
  | 'about'

type MenuLocale = 'zh-Hans' | 'zh-Hant' | 'en'

type MenuLabels = {
  file: string
  newProject: string
  openChm: string
  openProject: string
  goHome: string
  edit: string
  view: string
  window: string
  reload: string
  devTools: string
  zoomIn: string
  zoomOut: string
  resetZoom: string
  fullscreen: string
  help: string
  settings: string
  about: string
}

type DialogLabels = {
  openChm: string
  openProject: string
}

const MENU_LABELS: Record<MenuLocale, MenuLabels> = {
  'zh-Hans': {
    file: '文件',
    newProject: '新建创作项目…',
    openChm: '打开 CHM…',
    openProject: '打开创作项目…',
    goHome: '返回首页',
    edit: '编辑',
    view: '视图',
    window: '窗口',
    reload: '重新加载',
    devTools: '开发者工具',
    zoomIn: '放大',
    zoomOut: '缩小',
    resetZoom: '重置缩放',
    fullscreen: '全屏',
    help: '帮助',
    settings: '设置',
    about: '关于 CHM 助手',
  },
  'zh-Hant': {
    file: '檔案',
    newProject: '新增創作專案…',
    openChm: '開啟 CHM…',
    openProject: '開啟創作專案…',
    goHome: '返回首頁',
    edit: '編輯',
    view: '檢視',
    window: '視窗',
    reload: '重新載入',
    devTools: '開發者工具',
    zoomIn: '放大',
    zoomOut: '縮小',
    resetZoom: '重設縮放',
    fullscreen: '全螢幕',
    help: '說明',
    settings: '設定',
    about: '關於 CHM 助手',
  },
  en: {
    file: 'File',
    newProject: 'New Project…',
    openChm: 'Open CHM…',
    openProject: 'Open Project…',
    goHome: 'Home',
    edit: 'Edit',
    view: 'View',
    window: 'Window',
    reload: 'Reload',
    devTools: 'Developer Tools',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    resetZoom: 'Reset Zoom',
    fullscreen: 'Toggle Full Screen',
    help: 'Help',
    settings: 'Settings',
    about: 'About CHM Assistant',
  },
}

const DIALOG_LABELS: Record<MenuLocale, DialogLabels> = {
  'zh-Hans': {
    openChm: '打开 CHM 文件',
    openProject: '打开创作项目目录',
  },
  'zh-Hant': {
    openChm: '開啟 CHM 檔案',
    openProject: '開啟創作專案目錄',
  },
  en: {
    openChm: 'Open CHM file',
    openProject: 'Open project folder',
  },
}

function resolveMenuLocale(mode: LocaleMode): MenuLocale {
  if (mode !== 'system') {
    return mode
  }
  const tag = app.getLocale().toLowerCase()
  if (tag.startsWith('zh-tw') || tag.startsWith('zh-hk') || tag.startsWith('zh-mo')) {
    return 'zh-Hant'
  }
  if (tag.startsWith('zh')) {
    return 'zh-Hans'
  }
  return 'en'
}

export function getDialogLabels(localeMode: LocaleMode): DialogLabels {
  return DIALOG_LABELS[resolveMenuLocale(localeMode)]
}

export function rebuildApplicationMenu(
  localeMode: LocaleMode,
  sendAction: (action: AppMenuAction) => void,
): void {
  const isMac = process.platform === 'darwin'
  const labels = MENU_LABELS[resolveMenuLocale(localeMode)]
  const showDevItems = !app.isPackaged

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              {
                label: labels.about,
                click: () => sendAction('about'),
              },
              { type: 'separator' as const },
              {
                label: labels.settings,
                accelerator: 'CmdOrCtrl+,',
                click: () => sendAction('settings'),
              },
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
      label: labels.file,
      submenu: [
        {
          label: labels.newProject,
          accelerator: 'CmdOrCtrl+N',
          click: () => sendAction('new-project'),
        },
        {
          label: labels.openProject,
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendAction('open-project'),
        },
        {
          label: labels.openChm,
          accelerator: 'CmdOrCtrl+O',
          click: () => sendAction('open-chm'),
        },
        { type: 'separator' },
        {
          label: labels.goHome,
          accelerator: 'CmdOrCtrl+Shift+H',
          click: () => sendAction('go-home'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: labels.edit,
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
      label: labels.view,
      submenu: [
        ...(showDevItems
          ? ([
              {
                label: labels.reload,
                accelerator: 'CmdOrCtrl+R',
                role: 'reload' as const,
              },
              {
                label: labels.devTools,
                accelerator: 'CmdOrCtrl+Shift+I',
                role: 'toggleDevTools' as const,
              },
              { type: 'separator' as const },
            ] satisfies Electron.MenuItemConstructorOptions[])
          : []),
        { label: labels.resetZoom, role: 'resetZoom' as const },
        { label: labels.zoomIn, role: 'zoomIn' as const },
        { label: labels.zoomOut, role: 'zoomOut' as const },
        { type: 'separator' as const },
        { label: labels.fullscreen, role: 'togglefullscreen' as const },
      ],
    },
    ...(!isMac
      ? [
          {
            label: labels.window,
            submenu: [
              { role: 'minimize' as const },
              { role: 'close' as const },
            ],
          },
          {
            label: labels.help,
            submenu: [
              {
                label: labels.settings,
                accelerator: 'CmdOrCtrl+,',
                click: () => sendAction('settings'),
              },
              { type: 'separator' as const },
              {
                label: labels.about,
                click: () => sendAction('about'),
              },
            ],
          },
        ]
      : []),
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

export function sendAppMenuAction(
  getWindow: () => BrowserWindow | null,
  action: AppMenuAction,
): void {
  getWindow()?.webContents.send('menu:action', action)
}
