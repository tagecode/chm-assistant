#!/usr/bin/env node
/**
 * 根据 Release 资产信息更新 WinGet manifest（版本、安装包 URL、SHA256、ReleaseNotesUrl）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkgDir = path.join(root, 'packaging', 'winget', 'manifests', 't', 'TageCode', 'CHMAssistant')

function parseArgs(argv) {
  const out = { version: '', tag: '', url: '', sha256: '' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--version') out.version = argv[++i]?.trim() ?? ''
    if (argv[i] === '--tag') out.tag = argv[++i]?.trim() ?? ''
    if (argv[i] === '--url') out.url = argv[++i]?.trim() ?? ''
    if (argv[i] === '--sha256') out.sha256 = argv[++i]?.trim().toUpperCase() ?? ''
  }
  if (!out.version || !out.url || !out.sha256) {
    console.error('[update-winget-manifest] 需要 --version --url --sha256（可选 --tag）')
    process.exit(1)
  }
  if (!out.tag) out.tag = out.version.startsWith('v') ? out.version : `v${out.version}`
  return out
}

const { version, tag, url, sha256 } = parseArgs(process.argv.slice(2))
const versionDir = path.join(pkgDir, version)

const versionPath = path.join(versionDir, 'TageCode.CHMAssistant.yaml')
let versionYaml = fs.readFileSync(versionPath, 'utf8')
versionYaml = versionYaml.replace(/^PackageVersion: .+$/m, `PackageVersion: ${version}`)
fs.writeFileSync(versionPath, versionYaml)

const installerPath = path.join(versionDir, 'TageCode.CHMAssistant.installer.yaml')
let installerYaml = fs.readFileSync(installerPath, 'utf8')
installerYaml = installerYaml.replace(/^PackageVersion: .+$/m, `PackageVersion: ${version}`)
installerYaml = installerYaml.replace(/^  InstallerUrl: .+$/m, `  InstallerUrl: ${url}`)
installerYaml = installerYaml.replace(/^  InstallerSha256: .+$/m, `  InstallerSha256: ${sha256}`)
fs.writeFileSync(installerPath, installerYaml)

const localePath = path.join(versionDir, 'TageCode.CHMAssistant.locale.en-US.yaml')
let localeYaml = fs.readFileSync(localePath, 'utf8')
localeYaml = localeYaml.replace(/^PackageVersion: .+$/m, `PackageVersion: ${version}`)
localeYaml = localeYaml.replace(
  /^ReleaseNotesUrl: .+$/m,
  `ReleaseNotesUrl: https://github.com/tagecode/chm-assistant/releases/tag/${tag}`,
)
fs.writeFileSync(localePath, localeYaml)

console.log(`[update-winget-manifest] OK ${version}`)
console.log(`  manifest: ${versionDir}`)
console.log(`  url: ${url}`)
console.log(`  sha256: ${sha256}`)
