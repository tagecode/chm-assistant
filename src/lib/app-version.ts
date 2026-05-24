import pkg from '../../package.json'

/** 与 package.json version 同步，供浏览器预览等非 Electron 环境使用 */
export const APP_VERSION = pkg.version

/** 关于页等展示用：统一加 v 前缀 */
export function formatAppVersion(version: string): string {
  const trimmed = version.trim()
  if (!trimmed) return 'v0.0.0'
  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`
}
