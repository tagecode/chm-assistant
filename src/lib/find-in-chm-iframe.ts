/** 向 CHM iframe 发送页内查找（需 chm-protocol 注入 find bridge）。 */
export function findInChmIframe(
  iframe: HTMLIFrameElement | null,
  query: string,
  forward: boolean,
): void {
  const q = query.trim()
  const win = iframe?.contentWindow
  if (!q || !win) return
  try {
    iframe?.focus()
    win.focus()
  } catch {
    /* ignore focus errors */
  }
  win.postMessage(
    {
      channel: 'chm-assistant-find',
      query: q,
      forward,
      requestId: crypto.randomUUID(),
    },
    '*',
  )
}

/** 预览页内查找高亮（输入时实时标黄，不跳转到下一处）。 */
export function previewFindInChmIframe(
  iframe: HTMLIFrameElement | null,
  query: string,
): void {
  const q = query.trim()
  const win = iframe?.contentWindow
  if (!win) return
  win.postMessage({ channel: 'chm-assistant-find-preview', query: q }, '*')
}

/** 清除 CHM 页内查找高亮。 */
export function clearFindInChmIframe(iframe: HTMLIFrameElement | null): void {
  iframe?.contentWindow?.postMessage({ channel: 'chm-assistant-find-clear' }, '*')
}
