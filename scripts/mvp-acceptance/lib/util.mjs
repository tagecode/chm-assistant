/** @typedef {{ id: string; title: string; status: 'pass' | 'fail' | 'skip' | 'warn'; message?: string; manual?: boolean }} CheckResult */

export const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
}

/**
 * @param {CheckResult} r
 */
export function formatResult(r) {
  const icon =
    r.status === 'pass'
      ? `${colors.green}✓${colors.reset}`
      : r.status === 'fail'
        ? `${colors.red}✗${colors.reset}`
        : r.status === 'warn'
          ? `${colors.yellow}!${colors.reset}`
          : `${colors.dim}○${colors.reset}`
  const tag = r.manual ? `${colors.dim}[人工]${colors.reset} ` : ''
  const msg = r.message ? ` — ${r.message}` : ''
  return `${icon} ${tag}${r.id}: ${r.title}${msg}`
}

/**
 * @param {CheckResult[]} results
 */
export function summarize(results) {
  const pass = results.filter((r) => r.status === 'pass').length
  const fail = results.filter((r) => r.status === 'fail').length
  const skip = results.filter((r) => r.status === 'skip').length
  const warn = results.filter((r) => r.status === 'warn').length
  const manual = results.filter((r) => r.manual).length
  return { pass, fail, skip, warn, manual, total: results.length }
}
