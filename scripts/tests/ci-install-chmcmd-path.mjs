import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'win32') {
  process.exit(0)
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chmcmd-path-'))
const fakeBin = path.join(tempDir, 'FreePascal', 'bin', 'i386-Win32')
const githubPath = path.join(tempDir, 'github-path.txt')
const powershell = path.join(
  process.env.SystemRoot ?? 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
)

fs.mkdirSync(fakeBin, { recursive: true })
fs.writeFileSync(path.join(fakeBin, 'chmcmd.exe'), '')
fs.writeFileSync(githubPath, '')

const result = spawnSync(
  powershell,
  [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    path.join(root, 'scripts', 'ci-install-chmcmd.ps1'),
  ],
  {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_PATH: githubPath,
      Path: `${fakeBin};${process.env.Path ?? ''}`,
    },
  },
)

assert.equal(result.status, 0, result.stderr || result.stdout)
assert.match(
  fs.readFileSync(githubPath, 'utf8'),
  new RegExp(fakeBin.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&'), 'i'),
  'ci-install-chmcmd.ps1 should persist the chmcmd directory to GITHUB_PATH',
)
