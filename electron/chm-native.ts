import { createRequire } from 'node:module'
import path from 'node:path'
import { app } from 'electron'

const require = createRequire(import.meta.url)

export interface ChmNativeAddon {
  openChm: (
    fsPath: string,
  ) => { ok: boolean; sessionId?: string; error?: string }
  closeChm: (sessionId: string) => void
  listPaths: (
    sessionId: string,
  ) => { ok: boolean; paths?: string[]; error?: string }
  readObject: (
    sessionId: string,
    objectPath: string,
  ) => { ok: boolean; data?: Buffer; error?: string }
}

let cached: ChmNativeAddon | null | undefined

export function getChmAddonPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'native/chm_addon.node')
  }
  return path.join(process.cwd(), 'native/build/Release/chm_addon.node')
}

export function getChmAddon(): ChmNativeAddon | null {
  if (cached !== undefined) {
    return cached
  }
  try {
    const modPath = getChmAddonPath()
    cached = require(modPath) as ChmNativeAddon
    return cached
  } catch {
    cached = null
    return null
  }
}
