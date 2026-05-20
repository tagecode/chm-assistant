import path from 'node:path'

import type { CompileLogLevel, CompileLogLine } from '../../src/shared/project'

function htmlRelToMdRel(fileRel: string): string {
  const norm = fileRel.replace(/\\/g, '/')
  if (/\.md$/i.test(norm)) {
    return norm
  }
  if (/\.html?$/i.test(norm)) {
    return norm.replace(/\.html?$/i, '.md')
  }
  return norm
}

function normalizeLogPath(
  rawPath: string,
  ctx: { rootPath: string; buildDir: string },
): string | undefined {
  let p = rawPath.replace(/\\/g, '/').trim()
  if (!p) {
    return undefined
  }
  const buildNorm = ctx.buildDir.replace(/\\/g, '/')
  const rootNorm = ctx.rootPath.replace(/\\/g, '/')
  if (path.isAbsolute(rawPath)) {
    const abs = path.normalize(rawPath)
    if (abs.startsWith(ctx.buildDir)) {
      p = path.relative(ctx.buildDir, abs).replace(/\\/g, '/')
    } else if (abs.startsWith(ctx.rootPath)) {
      return path.relative(ctx.rootPath, abs).replace(/\\/g, '/')
    }
  }
  if (p.startsWith(buildNorm)) {
    p = p.slice(buildNorm.length).replace(/^\/+/, '')
  }
  if (p.startsWith(rootNorm)) {
    return path.relative(ctx.rootPath, path.join(rootNorm, p)).replace(/\\/g, '/')
  }
  return htmlRelToMdRel(p.replace(/^\.?\//, ''))
}

/** 解析 hhc / chmcmd 单行输出，尽量提取源文件与行号。 */
export function parseCompilerLogLine(
  raw: string,
  ctx: { rootPath: string; buildDir: string },
): CompileLogLine {
  const trimmed = raw.trim()
  let level: CompileLogLevel = 'info'
  if (/\berror\b/i.test(trimmed) || /\bfatal\b/i.test(trimmed)) {
    level = 'error'
  } else if (/\bwarn/i.test(trimmed)) {
    level = 'warn'
  }

  // file.htm(12) : error HHCxxxx: message
  const hhcMatch = trimmed.match(
    /([^\s:()]+\.(?:html?|hhp|hhc|hhk|md))(?:\((\d+)(?:-(\d+))?\))?\s*:\s*(error|warning|warn|fatal)/i,
  )
  if (hhcMatch) {
    const sourcePath = normalizeLogPath(hhcMatch[1] ?? '', ctx)
    const line = hhcMatch[2] ? Number.parseInt(hhcMatch[2], 10) : undefined
    return {
      level: /error|fatal/i.test(hhcMatch[4] ?? '') ? 'error' : 'warn',
      message: trimmed,
      sourcePath,
      line: Number.isFinite(line) ? line : undefined,
    }
  }

  // file.htm(12): message  或  file.htm:12: error
  const parenMatch = trimmed.match(
    /([^\s:()]+\.(?:html?|hhp|hhc|hhk|md))\((\d+)\)/i,
  )
  if (parenMatch) {
    const sourcePath = normalizeLogPath(parenMatch[1] ?? '', ctx)
    const line = Number.parseInt(parenMatch[2] ?? '', 10)
    return {
      level,
      message: trimmed,
      sourcePath,
      line: Number.isFinite(line) ? line : undefined,
    }
  }

  const colonMatch = trimmed.match(
    /([^\s:()]+\.(?:html?|hhp|hhc|hhk|md)):(\d+):/i,
  )
  if (colonMatch) {
    const sourcePath = normalizeLogPath(colonMatch[1] ?? '', ctx)
    const line = Number.parseInt(colonMatch[2] ?? '', 10)
    return {
      level,
      message: trimmed,
      sourcePath,
      line: Number.isFinite(line) ? line : undefined,
    }
  }

  return { level, message: trimmed }
}
