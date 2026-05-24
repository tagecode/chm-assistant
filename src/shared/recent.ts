export const RECENT_MAX_COUNT_DEFAULT = 24
export const RECENT_MAX_COUNT_MIN = 1
export const RECENT_MAX_COUNT_MAX = 100

export function clampRecentMaxCount(value: unknown): number {
  const n =
    typeof value === 'number'
      ? value
      : Number.parseInt(typeof value === 'string' ? value : '', 10)
  if (!Number.isFinite(n)) {
    return RECENT_MAX_COUNT_DEFAULT
  }
  return Math.min(RECENT_MAX_COUNT_MAX, Math.max(RECENT_MAX_COUNT_MIN, Math.round(n)))
}
