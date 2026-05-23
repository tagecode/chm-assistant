import { spawn } from 'node:child_process'

import {
  formatCompilerProjectArg,
  resolveCompilerWorkingDir,
  type ChmCompilerPathProfile,
} from './hhp-generator'
import { resolveChmCompiler, type ResolvedCompiler } from '../compiler-resolve'

export {
  getCompilerStatus,
  resolveChmCompiler,
  resolveChmCompilerForBuild,
  HTML_HELP_WORKSHOP_DOWNLOAD_URL,
  HTML_HELP_WORKSHOP_DOWNLOAD_URL_BACKUP,
  HTML_HELP_WORKSHOP_DOWNLOAD_URLS,
} from '../compiler-resolve'
export type { CompilerStatus, ResolvedCompiler } from '../compiler-resolve'

export function runChmCompiler(
  hhpPath: string,
  profile: ChmCompilerPathProfile,
  customCompilerPath: string | null,
  compilerOverride?: ResolvedCompiler | null,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const compiler = compilerOverride ?? resolveChmCompiler(customCompilerPath)
  if (!compiler) {
    return Promise.resolve({
      code: 127,
      stdout: '',
      stderr: 'COMPILER_NOT_FOUND',
    })
  }

  const cwd = resolveCompilerWorkingDir(profile)

  return new Promise((resolve) => {
    const hhpArg = formatCompilerProjectArg(profile, hhpPath)
    const args = [...compiler.args, hhpArg]
    const child = spawn(compiler.cmd, args, {
      cwd,
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString()
    })
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    child.on('error', (err) => {
      resolve({ code: 1, stdout, stderr: `${stderr}\n${err.message}` })
    })
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}
