import fs from 'node:fs'
import path from 'node:path'

export function resolveChmFsPath(
  input: string,
): { ok: true; path: string } | { ok: false; message: string } {
  try {
    const abs = path.resolve(input)
    const real = fs.existsSync(abs) ? fs.realpathSync.native?.(abs) ?? fs.realpathSync(abs) : abs
    if (!real.toLowerCase().endsWith('.chm')) {
      return { ok: false, message: 'not_chm' }
    }
    const st = fs.statSync(real)
    if (!st.isFile()) {
      return { ok: false, message: 'not_file' }
    }
    return { ok: true, path: real }
  } catch {
    return { ok: false, message: 'fs_error' }
  }
}
