import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { HhpCompilerKind } from './hhp-generator'

/** 与 project-resources 一致：构建目录内单段路径名是否 ASCII 安全 */
export function isAsciiPathSegment(segment: string): boolean {
  if (/^[a-zA-Z]:$/.test(segment)) {
    return true
  }
  return (
    segment.length > 0 &&
    [...segment].every((ch) => {
      const c = ch.charCodeAt(0)
      return c >= 0x20 && c <= 0x7e && !/[<>:"|?*]/.test(ch)
    })
  )
}

/** 绝对路径任一路径段含非 ASCII（含中文输出文件名）则需中转编译 */
export function pathHasNonAsciiSegments(filePath: string): boolean {
  const resolved = path.resolve(filePath)
  let tail = resolved
  if (process.platform === 'win32') {
    const drive = /^([a-zA-Z]:)([\\/]|$)/.exec(resolved)
    if (drive) {
      tail = resolved.slice(drive[1].length).replace(/^[\\/]+/, '')
    }
  }
  const parts = tail.split(path.sep).filter(Boolean)
  return parts.some((p) => !isAsciiPathSegment(p))
}

const CHMCMD_BUILD_DIR_NAME = '.chm-build'
const HHC_BUILD_DIR_NAME = 'chm-build-hhc'
/** 中转目录内固定输出名，避免中文 .chm 文件名进入 .hhp */
export const STAGING_CHM_OUTPUT_NAME = 'output.chm'

export type CompileWorkspace = {
  /** 读取 Markdown / 资源仍用项目根 */
  projectRoot: string
  /** 编译器工作目录（.hhp / HTML 中间文件） */
  buildDir: string
  /** 用户项目下的最终 CHM 路径 */
  finalChmPath: string
  /** 写入 .hhp 的 Compiled file（中转时为 ASCII 临时路径） */
  compilerChmPath: string
  staged: boolean
  /** 中转根目录；编译结束后应删除 */
  stagingRoot: string | null
}

function buildDirNameForCompiler(kind: HhpCompilerKind): string {
  return kind === 'hhc' ? HHC_BUILD_DIR_NAME : CHMCMD_BUILD_DIR_NAME
}

export type ValidateCompileTempDirResult =
  | { ok: true; path: string }
  | { ok: false; code: 'non_ascii' | 'invalid' }

/** 校验用户配置的编译临时目录（空字符串表示使用系统默认） */
export function validateCompileTempDir(input: string): ValidateCompileTempDirResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: true, path: '' }
  }
  let resolved: string
  try {
    resolved = path.resolve(trimmed)
  } catch {
    return { ok: false, code: 'invalid' }
  }
  if (pathHasNonAsciiSegments(resolved)) {
    return { ok: false, code: 'non_ascii' }
  }
  return { ok: true, path: resolved }
}

/** 选取 ASCII 安全的系统临时目录根（兼容用户名含中文的 TEMP） */
export function resolveAsciiCompileTempRoot(settingsBase?: string | null): string {
  const candidates: string[] = []
  const fromSettings = settingsBase?.trim()
  if (fromSettings) {
    candidates.push(fromSettings)
  }
  if (process.env.CHM_ASSISTANT_COMPILE_TMP?.trim()) {
    candidates.push(process.env.CHM_ASSISTANT_COMPILE_TMP.trim())
  }
  candidates.push(os.tmpdir())
  if (process.platform === 'win32') {
    if (process.env.TEMP?.trim()) {
      candidates.push(process.env.TEMP.trim())
    }
    if (process.env.TMP?.trim()) {
      candidates.push(process.env.TMP.trim())
    }
    const winDir = process.env.SystemRoot ?? process.env.WINDIR ?? 'C:\\Windows'
    candidates.push(path.join(winDir, 'Temp'))
    candidates.push('C:\\Temp')
  } else {
    candidates.push('/tmp', '/var/tmp')
  }

  const seen = new Set<string>()
  for (const c of candidates) {
    const base = path.resolve(c)
    if (seen.has(base)) {
      continue
    }
    seen.add(base)
    if (!pathHasNonAsciiSegments(base)) {
      return path.join(base, 'chm-assistant-compile')
    }
  }
  return path.join(os.tmpdir(), 'chm-assistant-compile')
}

export function needsCompilerAsciiStaging(paths: string[]): boolean {
  return paths.some((p) => pathHasNonAsciiSegments(p))
}

export function resolveCompileWorkspace(
  projectRoot: string,
  compilerKind: HhpCompilerKind,
  finalChmPath: string,
  opts?: { compileTempDir?: string | null },
): CompileWorkspace {
  const resolvedRoot = path.resolve(projectRoot)
  const resolvedFinal = path.resolve(finalChmPath)
  const localBuildDir = path.join(
    resolvedRoot,
    buildDirNameForCompiler(compilerKind),
  )

  if (
    !needsCompilerAsciiStaging([resolvedRoot, resolvedFinal, localBuildDir])
  ) {
    return {
      projectRoot: resolvedRoot,
      buildDir: localBuildDir,
      finalChmPath: resolvedFinal,
      compilerChmPath: resolvedFinal,
      staged: false,
      stagingRoot: null,
    }
  }

  const hash = crypto
    .createHash('sha256')
    .update(resolvedRoot)
    .digest('hex')
    .slice(0, 16)
  const stagingRoot = path.join(
    resolveAsciiCompileTempRoot(opts?.compileTempDir),
    hash,
  )
  const buildDir = path.join(stagingRoot, buildDirNameForCompiler(compilerKind))
  const compilerChmPath = path.join(
    stagingRoot,
    'dist',
    STAGING_CHM_OUTPUT_NAME,
  )

  return {
    projectRoot: resolvedRoot,
    buildDir,
    finalChmPath: resolvedFinal,
    compilerChmPath,
    staged: true,
    stagingRoot,
  }
}

export function removeCompileStagingRoot(stagingRoot: string | null): void {
  if (!stagingRoot) {
    return
  }
  try {
    fs.rmSync(stagingRoot, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}

/** 将中转目录中的 CHM 复制到项目最终输出路径 */
export function promoteStagedChmOutput(
  compilerChmPath: string,
  finalChmPath: string,
): { ok: true } | { ok: false; message: string } {
  try {
    fs.mkdirSync(path.dirname(finalChmPath), { recursive: true })
    fs.copyFileSync(compilerChmPath, finalChmPath)
    return { ok: true }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      message: `无法将编译产物复制到 ${finalChmPath}：${detail}`,
    }
  }
}
