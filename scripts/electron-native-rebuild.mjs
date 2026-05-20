import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)
const electronVersion = require('electron/package.json').version

/** 默认当前机器架构；CI 跨架构打包时设置 NATIVE_REBUILD_ARCH=x64|arm64 */
const arch = process.env.NATIVE_REBUILD_ARCH?.trim() || process.arch

execSync(
  `node-gyp rebuild --directory native --target=${electronVersion} --arch=${arch} --dist-url=https://electronjs.org/headers`,
  {
    stdio: 'inherit',
    env: { ...process.env, npm_config_arch: arch },
  },
)
