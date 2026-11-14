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

/**
 * Reminders (birthdays…) are not work at all: they show on their day and are
 * never overdue or counted, done or not. The default list matches the one the
 * page starts with.
 */
export const DEFAULT_REMINDER_PATTERNS = ['生日', 'Birthday', 'Anniversaire']

/** NULL in the database means the user never saved a list: use the default. */
export function parseReminderPatterns(raw: string | null | undefined): string[] {
  return raw == null ? DEFAULT_REMINDER_PATTERNS : parseRoutinePatterns(raw)
}

/** Every title keyword whose tasks the bookkeeping ignores: routine slots and reminders. */
export function untrackedPatterns(owner: { routinePatterns?: string | null; reminderPatterns?: string | null } | null | undefined): string[] {
  return [...parseRoutinePatterns(owner?.routinePatterns), ...parseReminderPatterns(owner?.reminderPatterns)]
}

/** The user columns `untrackedPatterns` reads, for a Prisma `select`. */
export const UNTRACKED_SELECT = { routinePatterns: true, reminderPatterns: true } as const
