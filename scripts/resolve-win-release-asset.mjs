#!/usr/bin/env node
/**
 * 从 GitHub Release 解析 Windows x64 NSIS 安装包（URL、文件名、SHA256）。
 *
 * 用法：
 *   node scripts/resolve-win-release-asset.mjs --tag v0.1.0
 *   node scripts/resolve-win-release-asset.mjs --version 0.1.0
 *
 * 写入 GITHUB_OUTPUT（若存在）并打印 JSON 到 stdout。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import process from 'node:process'

const REPO = process.env.GITHUB_REPOSITORY ?? 'tagecode/chm-assistant'

function parseArgs(argv) {
  let tag = ''
  let version = ''
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--tag') tag = argv[++i]?.trim() ?? ''
    if (argv[i] === '--version') version = argv[++i]?.trim() ?? ''
  }
  if (!tag && version) tag = version.startsWith('v') ? version : `v${version}`
  if (!tag) {
    console.error('[resolve-win-release-asset] 需要 --tag 或 --version')
    process.exit(1)
  }
  const semver = tag.replace(/^v/i, '')
  return { tag, version: semver }
}

function isWinInstallerAsset(name) {
  if (!/\.exe$/i.test(name)) return false
  if (/^elevate\.exe$/i.test(name)) return false
  if (/^CHM\.Assistant\.exe$/i.test(name)) return false
  return /-win-x64\.exe$/i.test(name)
}

function assetScore(name, version) {
  const normalized = name.toLowerCase()
  const ver = version.toLowerCase()
  let score = 0
  if (normalized.includes(`v${ver}-win-x64.exe`)) score += 10
  if (normalized.includes('chm assistant')) score += 5
  if (normalized.includes('chm-assistant')) score += 4
  if (normalized.includes('chm.assistant')) score += 3
  return score
}

function pickAsset(assets, version) {
  const candidates = assets.filter((a) => isWinInstallerAsset(a.name))
  if (candidates.length === 0) return null
  return candidates.sort((a, b) => assetScore(b.name, version) - assetScore(a.name, version))[0]
}

async function fetchRelease(tag) {
  const headers = { Accept: 'application/vnd.github+json' }
  const token = process.env.GITHUB_TOKEN?.trim()
  if (token) headers.Authorization = `Bearer ${token}`

  const url = `https://api.github.com/repos/${REPO}/releases/tags/${encodeURIComponent(tag)}`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} for ${url}`)
  }
  return res.json()
}

async function sha256FromUrl(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Download failed ${res.status}: ${url}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex').toUpperCase()
  return { sha256, size: buf.length }
}

function appendGithubOutput(pairs) {
  const file = process.env.GITHUB_OUTPUT
  if (!file) return
  const lines = Object.entries(pairs)
    .map(([k, v]) => `${k}=${String(v).replace(/\r?\n/g, '%0A')}`)
    .join('\n')
  fs.appendFileSync(file, `${lines}\n`)
}

const { tag, version } = parseArgs(process.argv.slice(2))

const release = await fetchRelease(tag)
const asset = pickAsset(release.assets ?? [], version)
if (!asset) {
  console.error(
    `[resolve-win-release-asset] 未在 ${tag} 找到 Windows x64 安装包（*-win-x64.exe，排除 elevate.exe）`,
  )
  process.exit(1)
}

console.log(`[resolve-win-release-asset] asset: ${asset.name}`)
const { sha256, size } = await sha256FromUrl(asset.browser_download_url)

const result = {
  tag,
  version,
  name: asset.name,
  url: asset.browser_download_url,
  sha256,
  size,
}

appendGithubOutput({
  tag,
  version,
  name: asset.name,
  url: asset.browser_download_url,
  sha256,
  size: String(size),
})

console.log(JSON.stringify(result, null, 2))
