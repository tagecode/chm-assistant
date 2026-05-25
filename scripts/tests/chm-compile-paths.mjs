import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'

import {
  isAsciiPathSegment,
  pathHasNonAsciiSegments,
  resolveAsciiCompileTempRoot,
  resolveCompileWorkspace,
  STAGING_CHM_OUTPUT_NAME,
  validateCompileTempDir,
} from '../../electron/chm-build/compile-paths.ts'

assert.equal(isAsciiPathSegment('D:'), true)
assert.equal(isAsciiPathSegment('docs'), true)
assert.equal(isAsciiPathSegment('指南'), false)

assert.equal(pathHasNonAsciiSegments('C:\\project\\docs'), false)
assert.equal(pathHasNonAsciiSegments('C:\\文档\\my-help'), true)
assert.equal(pathHasNonAsciiSegments('/home/user/project'), false)
assert.equal(pathHasNonAsciiSegments('/home/用户/project'), true)
assert.equal(pathHasNonAsciiSegments('D:\\project\\dist\\帮助.chm'), true)

const asciiRoot =
  process.platform === 'win32' ? 'C:\\chm-ascii-test' : '/tmp/chm-ascii-test'
const wsAscii = resolveCompileWorkspace(asciiRoot, 'chmcmd', path.join(asciiRoot, 'dist', 'out.chm'))
assert.equal(wsAscii.staged, false)
assert.equal(wsAscii.buildDir, path.join(path.resolve(asciiRoot), '.chm-build'))
assert.equal(wsAscii.compilerChmPath, wsAscii.finalChmPath)

const unicodeRoot =
  process.platform === 'win32' ? 'C:\\文档\\chm-test' : '/tmp/用户/chm-test'
const finalChm = path.join(unicodeRoot, 'dist', '手册.chm')
const ws = resolveCompileWorkspace(unicodeRoot, 'chmcmd', finalChm)
assert.equal(ws.staged, true)
assert.ok(ws.stagingRoot)
assert.ok(!pathHasNonAsciiSegments(ws.stagingRoot))
assert.ok(!pathHasNonAsciiSegments(ws.buildDir))
assert.ok(!pathHasNonAsciiSegments(ws.compilerChmPath))
assert.equal(ws.compilerChmPath, path.join(ws.stagingRoot, 'dist', STAGING_CHM_OUTPUT_NAME))
assert.equal(ws.finalChmPath, path.resolve(finalChm))
assert.equal(ws.projectRoot, path.resolve(unicodeRoot))

const tempRoot = resolveAsciiCompileTempRoot()
assert.ok(!pathHasNonAsciiSegments(tempRoot))

assert.deepEqual(validateCompileTempDir(''), { ok: true, path: '' })
assert.equal(validateCompileTempDir('C:\\Temp').ok, true)
assert.equal(validateCompileTempDir('C:\\文档').ok, false)
if (validateCompileTempDir('C:\\文档').ok === false) {
  assert.equal(validateCompileTempDir('C:\\文档').code, 'non_ascii')
}

const wsCustom = resolveCompileWorkspace(unicodeRoot, 'chmcmd', finalChm, {
  compileTempDir: 'C:\\Temp',
})
assert.ok(wsCustom.stagingRoot?.startsWith('C:\\Temp\\chm-assistant-compile'))

const wsHhc = resolveCompileWorkspace(unicodeRoot, 'hhc', finalChm)
assert.equal(wsHhc.staged, true)
assert.ok(wsHhc.buildDir.endsWith('chm-build-hhc'))

console.log('[chm-compile-paths] ok', { tempRoot, stagingRoot: ws.stagingRoot })
