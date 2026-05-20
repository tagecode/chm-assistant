#!/usr/bin/env node
/**
 * 校验 git tag 与 package.json version 一致（v{version}）。
 * 用于 release workflow：GITHUB_REF=refs/tags/v1.2.3 node scripts/check-release-version.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

const ref = process.env.GITHUB_REF?.trim() || ''
const argTag = process.argv[2]?.trim()
const tag = argTag || (ref.startsWith('refs/tags/') ? ref.slice('refs/tags/'.length) : '')

if (!tag) {
  console.log('[release-version] No tag to check (skip)')
  process.exit(0)
}

const expected = `v${pkg.version}`
if (tag !== expected) {
  console.error(
    `[release-version] Tag "${tag}" does not match package.json version "${expected}".\n` +
      `  Bump package.json or retag before release.`,
  )
  process.exit(1)
}

console.log(`[release-version] OK: ${tag} matches package.json ${pkg.version}`)
