#!/usr/bin/env node
/**
 * 根据 Release 资产信息更新 Chocolatey nuspec 与 install 脚本中的版本、URL、SHA256。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkgDir = path.join(root, 'packaging', 'chocolatey')

function parseArgs(argv) {
  const out = { version: '', url: '', sha256: '' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--version') out.version = argv[++i]?.trim() ?? ''
    if (argv[i] === '--url') out.url = argv[++i]?.trim() ?? ''
    if (argv[i] === '--sha256') out.sha256 = argv[++i]?.trim().toUpperCase() ?? ''
  }
  if (!out.version || !out.url || !out.sha256) {
    console.error('[update-chocolatey-package] 需要 --version --url --sha256')
    process.exit(1)
  }
  return out
}

const { version, url, sha256 } = parseArgs(process.argv.slice(2))

const nuspecPath = path.join(pkgDir, 'chm-assistant.nuspec')
let nuspec = fs.readFileSync(nuspecPath, 'utf8')
nuspec = nuspec.replace(/<version>[^<]+<\/version>/, `<version>${version}</version>`)
fs.writeFileSync(nuspecPath, nuspec)

const installPath = path.join(pkgDir, 'tools', 'chocolateyinstall.ps1')
let install = fs.readFileSync(installPath, 'utf8')
install = install.replace(/^\$version = '[^']*'/m, `$version = '${version}'`)
install = install.replace(/^\$url64 = '[^']*'/m, `$url64 = '${url}'`)
install = install.replace(/^\$checksum64 = '[^']*'/m, `$checksum64 = '${sha256}'`)
fs.writeFileSync(installPath, install)

console.log(`[update-chocolatey-package] OK ${version}`)
console.log(`  url: ${url}`)
console.log(`  sha256: ${sha256}`)
