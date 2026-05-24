#!/usr/bin/env node
/**
 * 单元测试：Windows Release 资产筛选逻辑（无网络）。
 */
import assert from 'node:assert/strict'

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

const assets = [
  { name: 'elevate.exe' },
  { name: 'CHM.Assistant.exe' },
  { name: 'CHM-Assistant-v0.1.0-win-x64.exe' },
  { name: 'CHM.Assistant-v0.1.0-win-x64.exe' },
  { name: 'CHM Assistant-v0.1.0-win-x64.exe' },
]

assert.equal(isWinInstallerAsset('elevate.exe'), false)
assert.equal(isWinInstallerAsset('CHM.Assistant.exe'), false)
assert.equal(isWinInstallerAsset('CHM-Assistant-v0.1.0-win-x64.exe'), true)

const picked = pickAsset(assets, '0.1.0')
assert.equal(picked.name, 'CHM Assistant-v0.1.0-win-x64.exe')

console.log('[test:resolve-win-release-asset] OK')
