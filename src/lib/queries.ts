import { prisma } from '@/lib/prisma'
import { isDemoUser, getDemoTasks, getDemoHabits } from '@/lib/demo-data'

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
  return prisma.task.findMany({
    where: { userId, ...extraWhere },
    include: { subTasks: true },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function loadUserHabits(userId: string) {
  if (isDemoUser(userId)) return getDemoHabits()
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999)
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
