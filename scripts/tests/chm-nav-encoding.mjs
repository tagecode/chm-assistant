import assert from 'node:assert/strict'

import { generateHhc } from '../../electron/chm-build/hhc-generator.ts'
import { generateHhk } from '../../electron/chm-build/hhk-generator.ts'
import { decodeChmNavText } from '../../electron/chm-text.ts'

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
