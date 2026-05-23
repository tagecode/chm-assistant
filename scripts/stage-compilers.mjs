#!/usr/bin/env node
/**
 * 将本机 chmcmd 复制到 resources/compilers/<platform>-<arch>/，供 electron-builder 打入安装包。
 * 不捆绑 hhc.exe（微软 EULA 不允许随应用再分发编译器）。
 *
 * 目标架构：NATIVE_REBUILD_ARCH（与 native 模块 / electron-builder 一致），默认 process.arch。
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const stageArch = process.env.NATIVE_REBUILD_ARCH?.trim() || process.arch
const key = `${process.platform}-${stageArch}`
const destDir = path.join(root, 'resources', 'compilers', key)
const destName = process.platform === 'win32' ? 'chmcmd.exe' : 'chmcmd'

function findChmcmdWin() {
  try {
    const out = execSync('where chmcmd.exe', { encoding: 'utf8', shell: true }).trim()
    const first = out.split(/\r?\n/).find((line) => line.trim())
    if (first && fs.existsSync(first.trim())) {
      return first.trim()
    }
  } catch {
    /* ignore */
  }

  const fpcDir = process.env.FPCDIR?.trim()
  const candidates = []
  if (fpcDir) {
    candidates.push(
      path.join(fpcDir, 'bin', 'i386-win32', 'chmcmd.exe'),
      path.join(fpcDir, 'bin', 'x86_64-win64', 'chmcmd.exe'),
    )
  }
  for (const ver of ['3.2.2', '3.2.0', '3.0.4']) {
    candidates.push(
      path.join('C:\\FPC', ver, 'bin', 'i386-win32', 'chmcmd.exe'),
      path.join('C:\\FPC', ver, 'bin', 'x86_64-win64', 'chmcmd.exe'),
    )
  }
  candidates.push(
    path.join(
      process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
      'FPC',
      '3.2.2',
      'bin',
      'i386-win32',
      'chmcmd.exe',
    ),
  )

  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      return p
    }
  }

  for (const rootDir of ['C:\\FPC', path.join(process.env.LOCALAPPDATA ?? '', 'FPC')]) {
    if (!rootDir || !fs.existsSync(rootDir)) {
      continue
    }
    try {
      for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue
        }
        for (const sub of ['i386-win32', 'x86_64-win64']) {
          const p = path.join(rootDir, entry.name, 'bin', sub, 'chmcmd.exe')
          if (fs.existsSync(p)) {
            return p
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
  return null
}

function findChmcmdUnix() {
  const hostArch = process.arch

  /** Apple Silicon runner 打包 macOS x64 时，需 x86_64 版 chmcmd */
  if (process.platform === 'darwin' && hostArch === 'arm64' && stageArch === 'x64') {
    try {
      const p = execSync('arch -x86_64 command -v chmcmd', {
        encoding: 'utf8',
        shell: '/bin/bash',
      }).trim()
      if (p && fs.existsSync(p)) {
        return p
      }
    } catch {
      /* ignore */
    }
    for (const p of ['/usr/local/bin/chmcmd']) {
      if (fs.existsSync(p)) {
        return p
      }
    }
    return null
  }

  try {
    const p = execSync('command -v chmcmd', { encoding: 'utf8' }).trim()
    if (p && fs.existsSync(p)) {
      return p
    }
  } catch {
    /* ignore */
  }
  const candidates = [
    '/opt/homebrew/bin/chmcmd',
    '/usr/local/bin/chmcmd',
    '/usr/bin/chmcmd',
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p
    }
  }
  return null
}

function findChmcmd() {
  return process.platform === 'win32' ? findChmcmdWin() : findChmcmdUnix()
}

const src = findChmcmd()
if (!src) {
  console.error(
    `[compilers:stage] 未找到适用于 ${key} 的 chmcmd。\n` +
      (process.platform === 'win32'
        ? '  Windows: 安装 Free Pascal（https://www.freepascal.org/download.html）\n' +
          '           或 choco install freepascal\n'
        : '') +
      (process.platform === 'darwin' && stageArch === 'x64'
        ? '  macOS x64：请在 Apple Silicon 上执行 arch -x86_64 brew install free-pascal\n'
        : '') +
      '  macOS:   brew install free-pascal\n' +
      '  Ubuntu:  sudo apt install fp-compiler fp-utils\n' +
      '详见 docs/compiler-setup.md',
  )
  process.exit(1)
}

fs.mkdirSync(destDir, { recursive: true })
const dest = path.join(destDir, destName)
fs.copyFileSync(src, dest)
if (process.platform !== 'win32') {
  fs.chmodSync(dest, 0o755)
}
console.log(`[compilers:stage] ${src} -> ${dest} (${key})`)
