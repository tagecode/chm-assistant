import iconv from 'iconv-lite'
import { parse } from 'node-html-parser'

export function sniffHtmlCharset(buf: Buffer): string | null {
  const head = buf.subarray(0, Math.min(buf.length, 65536)).toString('latin1')
  const m = head.match(/charset\s*=\s*["']?([a-zA-Z0-9._-]+)/i)
  return m?.[1] ?? null
}

function stripBom(buf: Buffer): Buffer {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3)
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return Buffer.from(buf.subarray(2).toString('utf16le'), 'utf8')
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.alloc(buf.length - 2)
    for (let i = 2; i < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1] ?? 0
      swapped[i - 1] = buf[i] ?? 0
    }
    return Buffer.from(swapped.toString('utf16le'), 'utf8')
  }
  return buf
}

function looksLikeValidUtf8(buf: Buffer): boolean {
  try {
    const s = buf.toString('utf8')
    if (s.includes('\uFFFD')) {
      return false
    }
    return true
  } catch {
    return false
  }
}

/** auto 模式下的启发式：meta charset → BOM → UTF-8 合法性 → GB 系高字节占比 */
export function detectEncodingHeuristic(buf: Buffer, isHtml: boolean): 'utf-8' | 'gb18030' | 'cp950' {
  const body = stripBom(buf)
  if (isHtml) {
    const tag = sniffHtmlCharset(body)?.toLowerCase() ?? ''
    if (
      tag &&
      (tag.includes('gb') || tag === 'windows-936' || tag === 'gbk' || tag === 'gb2312')
    ) {
      return 'gb18030'
    }
    if (tag.includes('big5') || tag === 'cp950') {
      return 'cp950'
    }
    if (tag.includes('utf-8') || tag === 'utf8') {
      return 'utf-8'
    }
  }
  if (looksLikeValidUtf8(body)) {
    let cjk = 0
    const sample = body.toString('utf8').slice(0, 8000)
    for (const ch of sample) {
      const c = ch.codePointAt(0) ?? 0
      if (c >= 0x4e00 && c <= 0x9fff) {
        cjk++
      }
    }
    if (cjk > 0) {
      return 'utf-8'
    }
  }
  let high = 0
  const n = Math.min(body.length, 8192)
  for (let i = 0; i < n; i++) {
    if (body[i] >= 0x80) {
      high++
    }
  }
  if (high > n * 0.02) {
    return 'gb18030'
  }
  return 'utf-8'
}

export function transcodeBuffer(buf: Buffer, pref: string, isHtml: boolean): Buffer {
  const body = stripBom(buf)
  if (!isHtml && pref === 'auto') {
    return body
  }
  if (pref === 'utf-8') {
    return body
  }
  if (pref === 'gb18030') {
    return Buffer.from(iconv.decode(body, 'gb18030'), 'utf8')
  }
  if (pref === 'auto') {
    const detected = detectEncodingHeuristic(body, isHtml)
    if (detected === 'gb18030') {
      return Buffer.from(iconv.decode(body, 'gb18030'), 'utf8')
    }
    if (detected === 'cp950') {
      return Buffer.from(iconv.decode(body, 'cp950'), 'utf8')
    }
    return body
  }
  const tag = isHtml ? sniffHtmlCharset(body)?.toLowerCase() : null
  if (
    tag &&
    (tag.includes('gb') || tag === 'windows-936' || tag === 'gbk' || tag === 'gb2312')
  ) {
    return Buffer.from(iconv.decode(body, 'gb18030'), 'utf8')
  }
  return body
}

function countCjk(s: string): number {
  let n = 0
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0
    if (c >= 0x4e00 && c <= 0x9fff) {
      n++
    }
  }
  return n
}

/** 目录/索引（.hhc/.hhk）在 CHM 内常为 GBK/Big5，单独加强解码。 */
export function decodeChmNavText(buf: Buffer, readerEncodingPref: string): string {
  const body = stripBom(buf)
  if (readerEncodingPref === 'utf-8') {
    return body.toString('utf8')
  }
  if (readerEncodingPref === 'gb18030') {
    return Buffer.from(iconv.decode(body, 'gb18030'), 'utf8').toString('utf8')
  }

  const tag = sniffHtmlCharset(body)?.toLowerCase() ?? ''
  if (tag.includes('big5') || tag === 'cp950') {
    return Buffer.from(iconv.decode(body, 'cp950'), 'utf8').toString('utf8')
  }
  if (
    tag.includes('gb') ||
    tag === 'gb2312' ||
    tag === 'gbk' ||
    tag === 'windows-936'
  ) {
    return Buffer.from(iconv.decode(body, 'gb18030'), 'utf8').toString('utf8')
  }
  if (tag.includes('utf-8') || tag === 'utf8') {
    return body.toString('utf8')
  }

  if (!looksLikeValidUtf8(body)) {
    return Buffer.from(iconv.decode(body, 'gb18030'), 'utf8').toString('utf8')
  }

  const asUtf8 = body.toString('utf8')
  const asGbk = iconv.decode(body, 'gb18030')
  if (countCjk(asGbk) > countCjk(asUtf8)) {
    return Buffer.from(asGbk, 'utf8').toString('utf8')
  }
  return asUtf8
}

export function decodeChmText(buf: Buffer, readerEncodingPref: string, isHtml: boolean): string {
  return transcodeBuffer(buf, readerEncodingPref, isHtml).toString('utf8')
}

/** 将已按 RD-08 解码的 HTML 转为纯文本（复制/摘要） */
export function htmlToPlainText(html: string): string {
  const doc = parse(html)
  for (const tag of ['script', 'style', 'noscript']) {
    doc.querySelectorAll(tag).forEach((el) => el.remove())
  }
  return doc.text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 从 HTML 页面提取可读标题（title → h1）。 */
export function extractHtmlTitle(html: string): string | null {
  try {
    const doc = parse(html, { lowerCaseTagName: true })
    const fromTitle = doc.querySelector('title')?.text?.replace(/\s+/g, ' ').trim() ?? ''
    if (fromTitle) {
      return fromTitle
    }
    const fromH1 = doc.querySelector('h1')?.text?.replace(/\s+/g, ' ').trim() ?? ''
    return fromH1 || null
  } catch {
    return null
  }
}
