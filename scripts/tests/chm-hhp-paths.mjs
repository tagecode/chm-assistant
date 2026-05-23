import assert from 'node:assert/strict'
import path from 'node:path'

import { generateHhc } from '../../electron/chm-build/hhc-generator.ts'
import { generateHhk } from '../../electron/chm-build/hhk-generator.ts'
import {
  formatCompilerProjectArg,
  formatNavLocalPath,
  generateHhp,
  resolveChmCompilerPathProfile,
  resolveCompilerWorkingDir,
} from '../../electron/chm-build/hhp-generator.ts'

const rootPath = 'D:\\chm-test'
const chmcmdBuildDir = path.join(rootPath, '.chm-build')
const hhcBuildDir = path.join(rootPath, 'chm-build-hhc')
const chmcmdHhpPath = path.join(chmcmdBuildDir, 'project.hhp')
const hhcHhpPath = path.join(hhcBuildDir, 'project.hhp')
const compiledFile = path.join(rootPath, 'dist', 'chm-test.chm')

const config = {
  title: 'chm-test',
  language: 'zh-CN',
  toc: [
    {
      id: 'home',
      title: '首页',
      mdPath: 'docs/index.md',
    },
  ],
}

const normalizeHhpPath = (value) => value.replace(/\\/g, '/')
const optionValue = (hhp, name) => {
  const line = hhp
    .split(/\r?\n/)
    .find((candidate) => candidate.toLowerCase().startsWith(`${name.toLowerCase()}=`))
  assert.ok(line, `missing HHP option: ${name}`)
  return line.slice(name.length + 1)
}

const hhcProfile = resolveChmCompilerPathProfile(rootPath, hhcBuildDir, 'hhc')
const chmcmdProfile = resolveChmCompilerPathProfile(rootPath, chmcmdBuildDir, 'chmcmd')
const hhcMdToHtml = (mdPath) =>
  formatNavLocalPath(hhcProfile, hhcBuildDir, mdPath.replace(/\.md$/i, '.html'))
const chmcmdMdToHtml = (mdPath) =>
  formatNavLocalPath(chmcmdProfile, chmcmdBuildDir, mdPath.replace(/\.md$/i, '.html'))

const hhcHhp = generateHhp(config, {
  buildDir: hhcBuildDir,
  compiledFile,
  contentsFile: path.join(hhcBuildDir, 'toc.hhc'),
  indexFile: path.join(hhcBuildDir, 'index.hhk'),
  defaultTopicHtml: path.join(hhcBuildDir, 'docs', 'index.html'),
  htmlFiles: [
    path.join(hhcBuildDir, 'docs', 'index.html'),
    path.join(hhcBuildDir, 'toc.hhc'),
    path.join(hhcBuildDir, 'index.hhk'),
  ],
  profile: hhcProfile,
})

assert.equal(path.basename(hhcBuildDir).startsWith('.'), false)
assert.equal(
  resolveCompilerWorkingDir(hhcProfile),
  hhcBuildDir,
  'hhc.exe should run from a normal, non-dot build directory',
)
assert.equal(
  normalizeHhpPath(formatCompilerProjectArg(hhcProfile, hhcHhpPath)),
  'project.hhp',
)
assert.equal(
  normalizeHhpPath(optionValue(hhcHhp, 'Compiled file')),
  normalizeHhpPath(compiledFile),
)
assert.equal(normalizeHhpPath(optionValue(hhcHhp, 'Contents file')), 'toc.hhc')
assert.equal(normalizeHhpPath(optionValue(hhcHhp, 'Index file')), 'index.hhk')
assert.equal(normalizeHhpPath(optionValue(hhcHhp, 'Default Topic')), 'docs/index.html')
assert.match(
  hhcHhp,
  /\[FILES\]\r?\ndocs[\\/]index\.html\r?\ntoc\.hhc\r?\nindex\.hhk/,
)
assert.match(
  generateHhc(config.toc, hhcMdToHtml),
  /<param name="Local" value="docs[\\/]index\.html">/,
)
assert.match(
  generateHhk(config.toc, hhcMdToHtml),
  /<param name="Local" value="docs[\\/]index\.html">/,
)

const chmcmdHhp = generateHhp(config, {
  buildDir: chmcmdBuildDir,
  compiledFile,
  contentsFile: path.join(chmcmdBuildDir, 'toc.hhc'),
  indexFile: path.join(chmcmdBuildDir, 'index.hhk'),
  defaultTopicHtml: path.join(chmcmdBuildDir, 'docs', 'index.html'),
  htmlFiles: [path.join(chmcmdBuildDir, 'docs', 'index.html')],
  profile: chmcmdProfile,
  hhpCharset: '65001',
})

assert.equal(
  resolveCompilerWorkingDir(chmcmdProfile),
  chmcmdBuildDir,
  'chmcmd should keep using the build directory as its project base',
)
assert.equal(normalizeHhpPath(formatCompilerProjectArg(chmcmdProfile, chmcmdHhpPath)), 'project.hhp')
assert.equal(
  normalizeHhpPath(optionValue(chmcmdHhp, 'Compiled file')),
  normalizeHhpPath(compiledFile),
)
assert.equal(normalizeHhpPath(optionValue(chmcmdHhp, 'Contents file')), 'toc.hhc')
assert.equal(normalizeHhpPath(optionValue(chmcmdHhp, 'Index file')), 'index.hhk')
assert.equal(normalizeHhpPath(optionValue(chmcmdHhp, 'Default Topic')), 'docs/index.html')
assert.match(chmcmdHhp, /\[FILES\]\r?\ndocs\/index\.html/)
assert.match(
  generateHhc(config.toc, chmcmdMdToHtml),
  /<param name="Local" value="docs[\\/]index\.html">/,
)
assert.match(
  generateHhk(config.toc, chmcmdMdToHtml),
  /<param name="Local" value="docs[\\/]index\.html">/,
)
