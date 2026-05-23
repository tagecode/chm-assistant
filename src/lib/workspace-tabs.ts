import type { WorkspaceTab } from '@/types/workspace'

function basename(path: string): string {
  const norm = path.replace(/\\/g, '/')
  const i = norm.lastIndexOf('/')
  return i >= 0 ? norm.slice(i + 1) : norm
}

/** 用于判断同一 CHM / 项目是否已打开 */
export function normalizeWorkspacePath(path: string, platform?: string): string {
  const norm = path.replace(/\\/g, '/').replace(/\/+$/, '')
  if (platform === 'win32' || platform === 'darwin') {
    return norm.toLowerCase()
  }
  return norm
}

export function workspaceTabKey(tab: WorkspaceTab, platform?: string): string {
  return `${tab.kind}:${normalizeWorkspacePath(tab.path, platform)}`
}

export function findTabByPath(
  tabs: WorkspaceTab[],
  kind: WorkspaceTab['kind'],
  path: string,
  platform?: string,
): WorkspaceTab | undefined {
  const key = `${kind}:${normalizeWorkspacePath(path, platform)}`
  return tabs.find((t) => workspaceTabKey(t, platform) === key)
}

/** 标签页显示名：CHM 带 .chm 后缀；项目为目录名或项目标题 */
export function formatWorkspaceTabLabel(tab: WorkspaceTab): string {
  if (tab.kind === 'reader') {
    return basename(tab.path)
  }
  const folder = basename(tab.path)
  return tab.title?.trim() || folder
}

/** 恢复会话时去掉重复路径，并关闭多余 CHM 会话 */
export function dedupeWorkspaceTabs(
  tabs: WorkspaceTab[],
  platform?: string,
  onCloseReaderSession?: (sessionId: string) => void,
): WorkspaceTab[] {
  const seen = new Set<string>()
  const out: WorkspaceTab[] = []
  for (const tab of tabs) {
    const key = workspaceTabKey(tab, platform)
    if (seen.has(key)) {
      if (tab.kind === 'reader') {
        onCloseReaderSession?.(tab.sessionId)
      }
      continue
    }
    seen.add(key)
    out.push(tab)
  }
  return out
}
