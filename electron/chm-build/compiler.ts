import { spawn } from 'node:child_process'

import { resolveChmCompiler } from '../compiler-resolve'

export { getCompilerStatus, HTML_HELP_WORKSHOP_DOWNLOAD_URL } from '../compiler-resolve'
export type { CompilerStatus, ResolvedCompiler } from '../compiler-resolve'

export function runChmCompiler(
  hhpPath: string,
  cwd: string,
  customCompilerPath: string | null,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const compiler = resolveChmCompiler(customCompilerPath)
  if (!compiler) {
    return Promise.resolve({
      code: 127,
      stdout: '',
      stderr: 'COMPILER_NOT_FOUND',
    })
  }

  return new Promise((resolve) => {
    const args = [...compiler.args, hhpPath]
    const child = spawn(compiler.cmd, args, {
      cwd,
      windowsHide: true,
      shell: process.platform === 'win32',
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
