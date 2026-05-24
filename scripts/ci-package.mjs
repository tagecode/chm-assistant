#!/usr/bin/env node
/**
 * CI / 指定架构打包：dist:prepare → compilers:stage → build → electron-builder --{platform} --{arch}
 *
 * 环境变量：
 *   CI_PLATFORM  mac | win | linux
 *   CI_ARCH      x64 | arm64
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const platform = process.env.CI_PLATFORM?.trim()
const arch = process.env.CI_ARCH?.trim()

if (!platform || !arch) {
  console.error('[ci-package] 需要环境变量 CI_PLATFORM 与 CI_ARCH')
  process.exit(1)
}

if (!['mac', 'win', 'linux'].includes(platform)) {
  console.error(`[ci-package] 无效 CI_PLATFORM: ${platform}`)
  process.exit(1)
}

if (!['x64', 'arm64'].includes(arch)) {
  console.error(`[ci-package] 无效 CI_ARCH: ${arch}`)
  process.exit(1)
}

const env = {
  ...process.env,
  NATIVE_REBUILD_ARCH: arch,
}

function run(cmd) {
  console.log(`[ci-package] ▶ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', env, shell: true })
}

const iconFiles = [
  'build/icon.png',
  'build/icon.ico',
  'build/icon.icns',
  'build/icons/256x256.png',
]

for (const rel of iconFiles) {
  if (!fs.existsSync(path.join(process.cwd(), rel))) {
    console.error(`[ci-package] 缺少打包图标: ${rel}`)
    console.error('[ci-package] 请运行 pnpm run icons:generate（macOS 可生成 .icns），并提交 build/ 目录')
    process.exit(1)
  }
}

run('pnpm run dist:prepare')
run('pnpm run compilers:stage')
run('pnpm run build')
run(`pnpm exec electron-builder --${platform} --${arch}`)

console.log(`[ci-package] done: ${platform}-${arch}`)
