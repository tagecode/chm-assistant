import { session } from 'electron'

import type { ChmNativeAddon } from './chm-native'
import { getChmAddon } from './chm-native'
import { decodeChmText, transcodeBuffer } from './chm-text'
import { injectFindBridge } from './chm-find-bridge'
import { injectTocSyncBridge } from './chm-toc-sync'

/** 宽松 CSP：旧式 CHM 常见内联脚本与相对资源；后续可按 PRD 收窄。 */
const CHM_RESPONSE_CSP = [
  "default-src 'self' chm: data: blob: https: http:",
  "script-src 'self' chm: data: blob: https: http: 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' chm: data: blob: https: http: 'unsafe-inline'",
  "img-src 'self' chm: data: blob: https: http:",
  "font-src 'self' chm: data: blob: https: http:",
  "connect-src 'self' chm: data: blob: https: http:",
  "frame-src 'self' chm: data: blob:",
  "base-uri 'self' chm:",
].join('; ')

function parseChmRequestUrl(
  requestUrl: string,
): { sessionId: string; objectPath: string } | null {
  let u: URL
  try {
    u = new URL(requestUrl)
  } catch {
    return null
  }
  if (u.protocol !== 'chm:') {
    return null
  }
  const sessionId = u.hostname
  if (!sessionId || !/^[a-f0-9]{32}$/i.test(sessionId)) {
    return null
  }
  let objectPath = decodeURIComponent(u.pathname)
  if (!objectPath || objectPath === '') {
    objectPath = '/'
  }
  return { sessionId, objectPath }
}

function mimeAndTextual(internalPath: string): { mime: string; textual: boolean } {
  const lower = internalPath.toLowerCase()
  const ext = lower.slice(lower.lastIndexOf('.'))
  const table: Record<string, { mime: string; textual: boolean }> = {
    '.html': { mime: 'text/html', textual: true },
    '.htm': { mime: 'text/html', textual: true },
    '.css': { mime: 'text/css', textual: true },
    '.js': { mime: 'text/javascript', textual: true },
    '.xml': { mime: 'application/xml', textual: true },
    '.svg': { mime: 'image/svg+xml', textual: true },
    '.hhc': { mime: 'text/html', textual: true },
    '.hhk': { mime: 'text/html', textual: true },
    '.png': { mime: 'image/png', textual: false },
    '.jpg': { mime: 'image/jpeg', textual: false },
    '.jpeg': { mime: 'image/jpeg', textual: false },
    '.gif': { mime: 'image/gif', textual: false },
    '.ico': { mime: 'image/x-icon', textual: false },
    '.woff': { mime: 'font/woff', textual: false },
    '.woff2': { mime: 'font/woff2', textual: false },
  }
  return table[ext] ?? { mime: 'application/octet-stream', textual: false }
}

function readObjectBytes(
  addon: ChmNativeAddon,
  sessionId: string,
  objectPath: string,
): Buffer | null {
  const r = addon.readObject(sessionId, objectPath)
  if (!r.ok || !r.data) {
    return null
  }
  return r.data
}

/** 将 ms-its / mk:@MSITStore 等同卷链接改写为 chm:，便于 iframe 内跳转。 */
function rewriteChmHtmlLinks(html: string, sessionId: string): string {
  const toChmHref = (internalRaw: string) => {
    let internal = internalRaw.replace(/\\/g, '/')
    if (!internal.startsWith('/')) {
      internal = `/${internal}`
    }
    try {
      return new URL(internal, `chm://${sessionId}`).href
    } catch {
      return internalRaw
    }
  }
  let s = html
  s = s.replace(/ms-its:[^'">\s]+::([/][^'">\s]*)/gi, (_m, g1: string) => toChmHref(g1))
  s = s.replace(/mk:@MSITStore:[^'">\s]+::([/][^'">\s]*)/gi, (_m, g1: string) =>
    toChmHref(g1),
  )
  return s
}

export function registerChmProtocol(getReaderEncoding: () => string): void {
  const ses = session.defaultSession
  if (ses.protocol.isProtocolHandled('chm')) {
    ses.protocol.unhandle('chm')
  }
  ses.protocol.handle('chm', async (request) => {
    const addon = getChmAddon()
    if (!addon) {
      return new Response('CHM native module not loaded', { status: 503 })
    }
    const parsed = parseChmRequestUrl(request.url)
    if (!parsed) {
      return new Response('Bad CHM URL', { status: 400 })
    }
    const encPref = getReaderEncoding()
    const { mime: mimeType, textual: isText } = mimeAndTextual(parsed.objectPath)
    let body = readObjectBytes(addon, parsed.sessionId, parsed.objectPath)
    if (!body) {
      return new Response('Not found', { status: 404 })
    }
    if (mimeType === 'text/html') {
      let text = decodeChmText(body, encPref, true)
      text = rewriteChmHtmlLinks(text, parsed.sessionId)
      text = injectFindBridge(text)
      text = injectTocSyncBridge(text)
      body = Buffer.from(text, 'utf8')
    } else if (isText) {
      body = transcodeBuffer(body, encPref, false)
    }
    const charset = isText ? '; charset=utf-8' : ''
    const headers: Record<string, string> = {
      'Content-Type': `${mimeType}${charset}`,
      'Content-Security-Policy': CHM_RESPONSE_CSP,
    }
    return new Response(new Uint8Array(body), { headers })
  })
}
