/** 生成可在 iframe / 导航中使用的 chm: URL（sessionId 为 32 位十六进制）。 */
export function buildChmPageUrl(
  sessionId: string,
  internalPath: string,
  fragment?: string,
): string {
  const p = internalPath.startsWith('/') ? internalPath : `/${internalPath}`
  const u = new URL(p, `chm://${sessionId}`)
  if (fragment) {
    u.hash = fragment.startsWith('#') ? fragment : `#${fragment}`
  }
  return u.href
}
