import assert from 'node:assert/strict'
import iconv from 'iconv-lite'

import { generateHhc } from '../../electron/chm-build/hhc-generator.ts'
import { generateHhk } from '../../electron/chm-build/hhk-generator.ts'
import { decodeChmNavText, decodeChmSystemString } from '../../electron/chm-text.ts'

const toc = [
  {
    id: 'home',
    title: '首页',
    mdPath: 'docs/index.md',
    children: [
      {
        id: 'chapter',
        title: '第一章',
        mdPath: 'docs/chapter.md',
      },
    ],
  },
]

const mdToHtml = (mdPath) => mdPath.replace(/\.md$/i, '.html')

const hhcWithoutCharset = generateHhc(toc, mdToHtml)
const decodedHhc = decodeChmNavText(Buffer.from(hhcWithoutCharset, 'utf8'), 'auto')
assert.match(decodedHhc, /首页/, 'auto nav decoding should preserve UTF-8 TOC titles without charset')
assert.match(decodedHhc, /第一章/, 'auto nav decoding should preserve nested UTF-8 TOC titles without charset')

const hhkWithoutCharset = generateHhk(toc, mdToHtml)
const decodedHhk = decodeChmNavText(Buffer.from(hhkWithoutCharset, 'utf8'), 'auto')
assert.match(decodedHhk, /首页/, 'auto nav decoding should preserve UTF-8 index titles without charset')

const hhcWithDefaultCharset = generateHhc(toc, mdToHtml)
assert.match(hhcWithDefaultCharset, /charset=UTF-8/i, 'generated TOC should declare UTF-8 by default')

const hhkWithDefaultCharset = generateHhk(toc, mdToHtml)
assert.match(hhkWithDefaultCharset, /charset=UTF-8/i, 'generated index should declare UTF-8 by default')

const hhcGbk = generateHhc(toc, mdToHtml, { metaCharset: 'GB2312' })
const hhcGbkBuf = iconv.encode(hhcGbk, 'gb18030')
const decodedGbkNav = decodeChmNavText(hhcGbkBuf, 'auto')
assert.match(decodedGbkNav, /首页/, 'GB2312 nav should decode as GBK')
assert.match(decodedGbkNav, /第一章/, 'nested GB2312 nav titles should decode')

const hhcUtf16 = Buffer.from(hhcGbk, 'utf16le')
const decodedUtf16Nav = decodeChmNavText(hhcUtf16, 'auto')
assert.match(decodedUtf16Nav, /首页/, 'UTF-16 LE nav should decode for hhc-style CHM')
assert.match(decodedUtf16Nav, /第一章/, 'nested UTF-16 LE nav titles should decode')

const sysGbkTitle = iconv.encode('中文手册', 'gb18030')
assert.match(decodeChmSystemString(sysGbkTitle, 'auto'), /中文手册/, 'GBK system title')

const sysUtf16Title = Buffer.from('中文手册', 'utf16le')
assert.match(decodeChmSystemString(sysUtf16Title, 'auto'), /中文手册/, 'UTF-16 system title')

console.log('[chm-nav-encoding] ok')
