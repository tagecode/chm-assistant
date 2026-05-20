export function normalizeChmInternalPath(p: string): string {
  const x = p.replace(/\\/g, '/')
  return x.startsWith('/') ? x : `/${x}`
}
