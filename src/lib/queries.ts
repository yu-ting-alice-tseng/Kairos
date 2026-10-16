import { prisma } from '@/lib/prisma'
import { isDemoUser, getDemoTasks, getDemoHabits } from '@/lib/demo-data'
import { zonedDayRange } from '@/lib/timezones'

/**
 * Task and habit reads shared by the API routes and the server-rendered Today
 * page. Keeping one definition means the page's first paint and the client's
 * later revalidation can never disagree about shape or ordering.
 *
 * `calendarAccount` is deliberately not included: nothing on the client reads
 * it (the account list comes from the store), and on libsql every `include` is
 * its own round trip.
 */
export async function loadUserTasks(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extraWhere: Record<string, any> = {}
) {
  if (isDemoUser(userId)) return getDemoTasks()
  const orderBy = [{ priority: 'desc' as const }, { createdAt: 'desc' as const }]
  if (Object.keys(extraWhere).length > 0) {
    return prisma.task.findMany({ where: { userId, ...extraWhere }, include: { subTasks: true }, orderBy })
  }
  // The full list already holds every subtask, so attach them here instead of
  // letting `include` spend a second round trip re-reading the same rows.
  const tasks = await prisma.task.findMany({ where: { userId }, orderBy })
  const byParent = new Map<string, typeof tasks>()
  for (const t of tasks) {
    if (!t.parentTaskId) continue
    const list = byParent.get(t.parentTaskId)
    if (list) list.push(t)
    else byParent.set(t.parentTaskId, [t])
  }
  return tasks.map((t) => ({ ...t, subTasks: byParent.get(t.id) ?? [] }))
}

/** Habits with today's completions, "today" being the local day in `timeZone`. */
export async function loadUserHabits(userId: string, timeZone: string) {
  if (isDemoUser(userId)) return getDemoHabits()
  const { start: dayStart, end: dayEnd } = zonedDayRange(timeZone)
  return prisma.habit.findMany({
    where: { userId, isActive: true },
    include: { completions: { where: { completedAt: { gte: dayStart, lte: dayEnd } } } },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Prisma rows carry `Date` objects; the client components were written against
 * the JSON the API routes return. Passing rows through JSON gives a server
 * render the exact same shape as a fetch, so nothing downstream has to care
 * where the data came from.
 */
export function serialize<T>(rows: unknown): T {
  return JSON.parse(JSON.stringify(rows)) as T
}
