import type { ChmTocItem } from '@/shared/electron'

/** 目录滚动同步消息通道（与 electron/chm-toc-sync.ts bridge 对应）。 */

export const TOC_SYNC_ANCHORS_CHANNEL = 'chm-assistant-toc-anchors'
export const TOC_SYNC_ACTIVE_CHANNEL = 'chm-assistant-toc-active'

/** 下发当前页面的目录锚点列表给 iframe（RD-06 滚动同步）。 */
export function sendTocSyncAnchors(
  iframe: HTMLIFrameElement | null,
  anchorIds: string[],
): void {
  const win = iframe?.contentWindow
  if (!win) return
  win.postMessage({ channel: TOC_SYNC_ANCHORS_CHANNEL, anchorIds }, '*')
}

/** 从目录树中收集「当前页面」可导航到的锚点 id（含 fragment 的目录项，去重保序）。 */
export function collectPageAnchors(
  toc: ChmTocItem[],
  currentPath: string,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const walk = (nodes: ChmTocItem[]) => {
    for (const n of nodes) {
      if (n.path && n.path === currentPath && n.fragment) {
        if (!seen.has(n.fragment)) {
          seen.add(n.fragment)
          out.push(n.fragment)
        }
      }
      if (n.children?.length) {
        walk(n.children)
      }
    }
  }
  walk(toc)
  return out
}

/** 判断 isTocActive 消息（来自 iframe bridge），返回激活锚点或 null。 */
export function parseTocSyncActive(data: unknown): { anchor: string | null } | null {
  if (!data || typeof data !== 'object') return null
  const d = data as { channel?: unknown; anchor?: unknown }
  if (d.channel !== TOC_SYNC_ACTIVE_CHANNEL) return null
  const anchor = typeof d.anchor === 'string' ? d.anchor : null
  return { anchor }
}
