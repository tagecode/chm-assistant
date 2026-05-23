import { contextBridge, ipcRenderer, webUtils } from 'electron'

import type { CompileLogLine } from '../src/shared/project'
import type { ElectronApi } from '../src/shared/electron'

const electronApi: ElectronApi = {
  getAppMetadata: () => ipcRenderer.invoke('app:get-metadata'),
  getPathsForFileList: (files: File[]) =>
    Promise.resolve(files.map((file) => webUtils.getPathForFile(file))),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setTheme: (theme) => ipcRenderer.invoke('settings:set-theme', theme),
  setLocale: (locale) => ipcRenderer.invoke('settings:set-locale', locale),
  setReaderEncoding: (encoding) =>
    ipcRenderer.invoke('settings:set-reader-encoding', encoding),
  setChmCompilerPath: (compilerPath) =>
    ipcRenderer.invoke('settings:set-chm-compiler-path', compilerPath),
  getCompilerStatus: () => ipcRenderer.invoke('compiler:get-status'),
  pickCompilerDialog: () => ipcRenderer.invoke('dialog:pick-compiler'),
  openExternalUrl: (url) => ipcRenderer.invoke('shell:open-external', url),
  getRecent: () => ipcRenderer.invoke('recent:get'),
  addRecent: (entry) => ipcRenderer.invoke('recent:add', entry),
  clearRecent: () => ipcRenderer.invoke('recent:clear'),
  openChmDialog: () => ipcRenderer.invoke('dialog:open-chm'),
  openProjectDialog: () => ipcRenderer.invoke('dialog:open-project'),
  createProjectInDirectory: (rootPath, title) =>
    ipcRenderer.invoke('project:create', { rootPath, title }),
  openChmSession: (filePath) => ipcRenderer.invoke('chm:open-session', filePath),
  closeChmSession: (sessionId) => ipcRenderer.invoke('chm:close-session', sessionId),
  searchChmSession: (sessionId, query) =>
    ipcRenderer.invoke('chm:search', sessionId, query),
  getWorkspaceSession: () => ipcRenderer.invoke('workspace:get'),
  setWorkspaceSession: (session) => ipcRenderer.invoke('workspace:set', session),
  onMenuOpenChm: (handler) => {
    const listener = () => handler()
    ipcRenderer.on('menu:open-chm', listener)
    return () => {
      ipcRenderer.removeListener('menu:open-chm', listener)
    }
  },
  loadProject: (rootPath) => ipcRenderer.invoke('project:load', rootPath),
  saveProjectConfig: (rootPath, config) =>
    ipcRenderer.invoke('project:save-config', { rootPath, config }),
  readProjectMarkdown: (rootPath, mdPath) =>
    ipcRenderer.invoke('project:read-md', { rootPath, mdPath }),
  writeProjectMarkdown: (rootPath, mdPath, content) =>
    ipcRenderer.invoke('project:write-md', { rootPath, mdPath, content }),
  createProjectPage: (rootPath, config, title, mdPath, contextNodeId) =>
    ipcRenderer.invoke('project:create-page', {
      rootPath,
      config,
      title,
      mdPath,
      contextNodeId,
    }),
  createProjectFolder: (rootPath, config, folderName, contextNodeId) =>
    ipcRenderer.invoke('project:create-folder', {
      rootPath,
      config,
      folderName,
      contextNodeId,
    }),
  refreshProjectToc: (rootPath, config) =>
    ipcRenderer.invoke('project:refresh-toc', { rootPath, config }),
  compileProject: (rootPath, config) =>
    ipcRenderer.invoke('project:compile', { rootPath, config }),
  onCompileLog: (handler) => {
    const listener = (_e: unknown, line: CompileLogLine) => handler(line)
    ipcRenderer.on('project:compile-log', listener)
    return () => {
      ipcRenderer.removeListener('project:compile-log', listener)
    }
  },
  previewProjectMarkdown: (rootPath, mdPath, content) =>
    ipcRenderer.invoke('project:preview-html', { rootPath, mdPath, content }),
  openImportResourcesDialog: () => ipcRenderer.invoke('dialog:import-resources'),
  importProjectResources: (rootPath, config, sourcePaths) =>
    ipcRenderer.invoke('project:import-resources', { rootPath, config, sourcePaths }),
  listProjectAssets: (rootPath, config) =>
    ipcRenderer.invoke('project:list-assets', { rootPath, config }),
  renameProjectTocNode: (rootPath, config, nodeId, title, mdPath) =>
    ipcRenderer.invoke('project:rename-toc-node', {
      rootPath,
      config,
      nodeId,
      title,
      mdPath,
    }),
  deleteProjectTocNode: (rootPath, config, nodeId) =>
    ipcRenderer.invoke('project:delete-toc-node', { rootPath, config, nodeId }),
  moveProjectTocNode: (rootPath, config, nodeId, placement) =>
    ipcRenderer.invoke('project:move-toc-node', {
      rootPath,
      config,
      nodeId,
      placement,
    }),
  readChmPagePlainText: (sessionId, internalPath) =>
    ipcRenderer.invoke('chm:plain-text', { sessionId, internalPath }),
  openNoticesFile: () => ipcRenderer.invoke('app:open-notices'),
}

contextBridge.exposeInMainWorld('electronAPI', electronApi)
