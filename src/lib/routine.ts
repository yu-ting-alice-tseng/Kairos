/**
 * Routine slots: things put on the calendar to hold time (a shower, a
 * commute) rather than commitments. Skipping one says nothing, so once its
 * day has passed it is neither overdue work nor a miss in the stats. The row
 * is kept, only the bookkeeping ignores it.
 *
 * Shared by the client pages and the server routes, so it must stay free of
 * server-only imports.
 */

export function parseRoutinePatterns(raw: string | null | undefined): string[] {
  try {
    const value = JSON.parse(raw ?? '[]')
    return Array.isArray(value) ? value.filter((p): p is string => typeof p === 'string' && p.trim() !== '') : []
  } catch {
    return []
  }
}

/** Same matching as the other title filters: case-insensitive substring. */
export function isRoutineTitle(title: string, patterns: string[]): boolean {
  const lower = title.toLowerCase()
  return patterns.some((p) => p && lower.includes(p.toLowerCase()))
}
