import fs from 'node:fs'
import path from 'node:path'
import { compileProject } from '../dist-electron/chm-build/compile-project.js'
import { loadProjectConfig } from '../dist-electron/project-fs.js'

const root = path.resolve('test-results/chmcmd-debug')
fs.rmSync(root, { recursive: true, force: true })
fs.mkdirSync(root, { recursive: true })
fs.mkdirSync(path.join(root, 'docs'), { recursive: true })
fs.writeFileSync(
  path.join(root, 'docs', 'index.md'),
  '# Test\n\n中文测试内容\n',
  'utf8',
)
fs.writeFileSync(
  path.join(root, 'chmproj.json'),
  JSON.stringify(
    {
      title: 'Test CHM',
      language: 'zh-Hans',
      defaultPage: 'docs/index.md',
      docsDir: 'docs',
      toc: [{ title: '首页', mdPath: 'docs/index.md' }],
    },
    null,
    2,
  ),
  'utf8',
)

const config = loadProjectConfig(root)
const result = await compileProject(
  root,
  config,
  'C:/FPC/3.2.2/bin/i386-win32/chmcmd.exe',
)
console.log(JSON.stringify({ ok: result.ok, error: result.error, chmPath: result.chmPath }, null, 2))
if (!result.ok) {
  console.log('Last logs:', result.logs.slice(-15))
}
