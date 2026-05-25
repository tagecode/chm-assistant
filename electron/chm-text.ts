import iconv from 'iconv-lite'
import { parse } from 'node-html-parser'

export function sniffHtmlCharset(buf: Buffer): string | null {
  const head = buf.subarray(0, Math.min(buf.length, 65536)).toString('latin1')
  const m = head.match(/charset\s*=\s*["']?([a-zA-Z0-9._-]+)/i)
  return m?.[1] ?? null
}

function stripUtf8Bom(buf: Buffer): Buffer {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3)
  }
  return buf
}

/** hhc.exe 写入 CHM 的 .hhc/.hhk 常为 UTF-16 LE（可无 BOM） */
function looksLikeUtf16Le(buf: Buffer): boolean {
  if (buf.length < 8) {
    return false
  }
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    return true
  }
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    return true
  }
  let asciiEven = 0
  let zeroOdd = 0
  const n = Math.min(buf.length - 1, 80)
  for (let i = 0; i < n; i += 2) {
    if (buf[i] >= 0x20 && buf[i] < 0x7f) {
      asciiEven++
    }
    if (buf[i + 1] === 0) {
      zeroOdd++
    }
  }
  return asciiEven >= 4 && zeroOdd >= Math.max(4, asciiEven - 1)
}

function decodeUtf16LeToString(buf: Buffer): string | null {
  if (buf.length < 2) {
    return null
  }
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.subarray(2).toString('utf16le')
  }
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.alloc(buf.length - 2)
    for (let i = 2; i < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1] ?? 0
      swapped[i - 1] = buf[i] ?? 0
    }
    return swapped.toString('utf16le')
  }
  if (looksLikeUtf16Le(buf)) {
    return buf.toString('utf16le')
  }
  return null
}

function stripBom(buf: Buffer): Buffer {
  const utf16 = decodeUtf16LeToString(buf)
  if (utf16 != null) {
    return Buffer.from(utf16, 'utf8')
  }
  return stripUtf8Bom(buf)
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

function replacementPenalty(s: string): number {
  let n = 0
  for (const ch of s) {
    if (ch === '\uFFFD') {
      n += 8
    }
    if (ch === '\u0000') {
      n += 4
    }
  }
  return n
}

/** 在多种解码结果中择优（用于无 HTML meta 的 #SYSTEM 等） */
function pickUtf16WhenStrongest(buf: Buffer): string | null {
  if (buf.length < 2 || buf.length % 2 !== 0) {
    return null
  }
  const u16 = buf.toString('utf16le')
  if (u16.includes('\uFFFD')) {
    return null
  }
  const u8 = buf.toString('utf8')
  const gbk = iconv.decode(buf, 'gb18030')
  const s16 = scoreDecodedText(u16)
  const s8 = scoreDecodedText(u8)
  const sg = scoreDecodedText(gbk)
  if (s16 > s8 && s16 > sg) {
    return u16
  }
  if (s16 >= sg && s16 > s8 && countCjk(u16) > 0) {
    return u16
  }
  return null
}

function scoreDecodedText(s: string): number {
  return countCjk(s) * 4 - replacementPenalty(s)
}

type ChmTextEncoding = 'utf-8' | 'gb18030' | 'cp950' | 'utf16le'

function decodeRawBuffer(buf: Buffer, encoding: ChmTextEncoding): string {
  if (encoding === 'gb18030') {
    return iconv.decode(buf, 'gb18030')
  }
  if (encoding === 'cp950') {
    return iconv.decode(buf, 'cp950')
  }
  if (encoding === 'utf16le') {
    return buf.toString('utf16le')
  }
  return buf.toString('utf8')
}

function encodingCandidates(buf: Buffer): ChmTextEncoding[] {
  const out: ChmTextEncoding[] = ['utf-8', 'gb18030', 'cp950']
  if (buf.length >= 2 && buf.length % 2 === 0) {
    out.push('utf16le')
  }
  return out
}

function pickBestDecodedText(
  buf: Buffer,
  candidates: ChmTextEncoding[],
  metaTag?: string,
): string {
  let best = ''
  let bestScore = Number.NEGATIVE_INFINITY
  const tag = metaTag?.toLowerCase() ?? ''
  for (const enc of candidates) {
    const text = decodeRawBuffer(buf, enc)
    let score = scoreDecodedText(text)
    if (
      tag &&
      (tag.includes('gb') ||
        tag === 'gb2312' ||
        tag === 'gbk' ||
        tag === 'windows-936') &&
      enc === 'gb18030'
    ) {
      score += 6
    }
    if ((tag.includes('big5') || tag === 'cp950') && enc === 'cp950') {
      score += 6
    }
    if ((tag.includes('utf-8') || tag === 'utf8') && enc === 'utf-8') {
      score += 4
    }
    if (score > bestScore) {
      bestScore = score
      best = text
    }
  }
  return best
}

function decodeChmString(
  buf: Buffer,
  readerEncodingPref: string,
  opts: { isHtml: boolean },
): string {
  const utf16 = decodeUtf16LeToString(buf)
  if (utf16 != null) {
    return utf16
  }

  const body = stripUtf8Bom(buf)

  if (readerEncodingPref === 'utf-8') {
    return body.toString('utf8')
  }
  if (readerEncodingPref === 'gb18030') {
    return decodeRawBuffer(body, 'gb18030')
  }

  const metaTag = opts.isHtml ? sniffHtmlCharset(body) : null
  if (metaTag) {
    const lower = metaTag.toLowerCase()
    if (lower.includes('big5') || lower === 'cp950') {
      return decodeRawBuffer(body, 'cp950')
    }
    if (
      lower.includes('gb') ||
      lower === 'gb2312' ||
      lower === 'gbk' ||
      lower === 'windows-936'
    ) {
      return decodeRawBuffer(body, 'gb18030')
    }
    if (lower.includes('utf-8') || lower === 'utf8') {
      return body.toString('utf8')
    }
  }

  return pickBestDecodedText(
    body,
    encodingCandidates(body),
    metaTag ?? undefined,
  )
}

/** 目录/索引（.hhc/.hhk）在 CHM 内常为 GBK/Big5 或 UTF-16（hhc.exe），单独加强解码。 */
export function decodeChmNavText(buf: Buffer, readerEncodingPref: string): string {
  return decodeChmString(buf, readerEncodingPref, { isHtml: true })
}

/** #SYSTEM 等二进制串：可能为 UTF-16、GBK 或 UTF-8 */
export function decodeChmSystemString(buf: Buffer, readerEncodingPref: string): string {
  if (readerEncodingPref === 'auto') {
    const utf16 = pickUtf16WhenStrongest(buf)
    if (utf16 != null) {
      return utf16
    }
  }
  return decodeChmString(buf, readerEncodingPref, { isHtml: false })
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
