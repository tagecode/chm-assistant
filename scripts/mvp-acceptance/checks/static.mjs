import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../../..')

/** IF-07 核心路径 i18n key（须三语包均存在） */
export const CORE_UI_KEYS = [
  'nav.home',
  'nav.settings',
  'nav.about',
  'home.openChm',
  'home.newProject',
  'home.recent',
  'reader.side.toc',
  'reader.side.search',
  'reader.find',
  'reader.copy',
  'composer.save',
  'composer.compile',
  'composer.files',
  'settings.title',
  'settings.locale',
  'settings.theme',
  'about.title',
  'about.openNotices',
  'workspace.tabs.confirmClose',
  'composer.confirmSaveBeforeLeave',
]

function extractKeysFromTs(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const keys = new Set()
  for (const m of text.matchAll(/^\s*'([^']+)':/gm)) {
    keys.add(m[1])
  }
  return keys
}

function hasNoUtf8Bom(filePath) {
  const buf = fs.readFileSync(filePath)
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return false
  }
  return true
}

/**
 * @returns {import('../lib/util.mjs').CheckResult[]}
 */
export function runStaticChecks() {
  /** @type {import('../lib/util.mjs').CheckResult[]} */
  const out = []

  const distIndex = path.join(ROOT, 'dist/index.html')
  const distMain = path.join(ROOT, 'dist-electron/main.js')
  const nativeAddon = path.join(ROOT, 'native/build/Release/chm_addon.node')
  const noticesPublic = path.join(ROOT, 'public/NOTICES.md')
  const noticesDist = path.join(ROOT, 'dist/NOTICES.md')

  out.push({
    id: 'static.build.dist',
    title: '生产构建产物 dist/index.html',
    status: fs.existsSync(distIndex) ? 'pass' : 'fail',
    message: fs.existsSync(distIndex) ? undefined : '请先执行 npm run build',
  })
  out.push({
    id: 'static.build.electron',
    title: 'Electron 主进程 dist-electron/main.js',
    status: fs.existsSync(distMain) ? 'pass' : 'fail',
    message: fs.existsSync(distMain) ? undefined : '请先执行 npm run build',
  })
  out.push({
    id: 'static.native.addon',
    title: 'CHM 原生模块 chm_addon.node',
    status: fs.existsSync(nativeAddon) ? 'pass' : 'fail',
    message: fs.existsSync(nativeAddon)
      ? undefined
      : '请执行 pnpm run native:rebuild',
  })
  out.push({
    id: 'static.notices',
    title: 'NOTICES.md（public 与 dist）',
    status:
      fs.existsSync(noticesPublic) && fs.existsSync(noticesDist) ? 'pass' : 'warn',
    message:
      fs.existsSync(noticesPublic) && fs.existsSync(noticesDist)
        ? undefined
        : '缺少 NOTICES；关于页「打开 NOTICES」可能失败',
  })

  const locales = {
    'zh-Hans': path.join(ROOT, 'src/i18n/zh-Hans.ts'),
    'zh-Hant': path.join(ROOT, 'src/i18n/zh-Hant.ts'),
    en: path.join(ROOT, 'src/i18n/en.ts'),
  }
  const keySets = Object.fromEntries(
    Object.entries(locales).map(([name, fp]) => [name, extractKeysFromTs(fp)]),
  )
  const base = keySets['zh-Hans']
  let i18nOk = true
  const missing = []
  for (const key of CORE_UI_KEYS) {
    if (!base.has(key)) {
      i18nOk = false
      missing.push(`zh-Hans:${key}`)
    }
    for (const [locale, set] of Object.entries(keySets)) {
      if (locale === 'zh-Hans') continue
      if (!set.has(key)) {
        i18nOk = false
        missing.push(`${locale}:${key}`)
      }
    }
  }
  out.push({
    id: 'static.i18n.core',
    title: '核心界面文案 key（简/繁/英）',
    status: i18nOk ? 'pass' : 'fail',
    message: i18nOk ? `${CORE_UI_KEYS.length} keys` : `缺失: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`,
  })

  const fixtureDir = path.join(ROOT, 'test/fixtures')
  const corruptFixture = path.join(fixtureDir, 'corrupt/invalid.chm')
  out.push({
    id: 'static.fixture.corrupt',
    title: '内置损坏样例 test/fixtures/corrupt',
    status: fs.existsSync(corruptFixture) ? 'pass' : 'warn',
    message: fs.existsSync(corruptFixture) ? corruptFixture : '将随仓库提供最小损坏文件',
  })

  const tempProj = path.join(ROOT, 'test-results/_acceptance-scratch/project-utf8')
  try {
    fs.mkdirSync(tempProj, { recursive: true })
    fs.mkdirSync(path.join(tempProj, 'docs'), { recursive: true })
    const indexMd = path.join(tempProj, 'docs', 'index.md')
    const proj = path.join(tempProj, 'chm-assistant.chmproj')
    const content = '# 验收样例\n\n中文正文：帮助文档。\n'
    fs.writeFileSync(indexMd, content, { encoding: 'utf8' })
    fs.writeFileSync(
      proj,
      JSON.stringify(
        {
          version: 1,
          title: '验收 UTF-8',
          language: 'zh-Hans',
          charset: 'utf-8',
          defaultPage: 'docs/index.md',
          docsDir: 'docs',
          createdAt: new Date().toISOString(),
          toc: [{ id: '1', title: '首页', mdPath: 'docs/index.md' }],
        },
        null,
        2,
      ) + '\n',
      'utf8',
    )
    const bomOk = hasNoUtf8Bom(indexMd) && hasNoUtf8Bom(proj)
    out.push({
      id: 'static.project.utf8-nobom',
      title: '新建项目 Markdown / chmproj 无 UTF-8 BOM（7.2 静态部分）',
      status: bomOk ? 'pass' : 'fail',
      message: tempProj,
    })
  } catch (e) {
    out.push({
      id: 'static.project.utf8-nobom',
      title: '新建项目 UTF-8 无 BOM',
      status: 'fail',
      message: e instanceof Error ? e.message : String(e),
    })
  }

  const gbkEnv =
    process.env.CHM_ASSISTANT_GBK_SAMPLE ??
    path.join(fixtureDir, 'gbk/sample.chm')
  const gbkExists = fs.existsSync(gbkEnv)
  out.push({
    id: 'static.env.gbk-sample',
    title: 'GBK 样例 CHM（7.1 自动化）',
    status: gbkExists ? 'pass' : 'skip',
    message: gbkExists
      ? gbkEnv
      : '放置 test/fixtures/gbk/sample.chm 或设置 CHM_ASSISTANT_GBK_SAMPLE',
  })

  return out
}
