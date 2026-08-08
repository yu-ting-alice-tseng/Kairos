import { prisma } from '@/lib/prisma'
import { isDemoUser, getDemoTasks } from '@/lib/demo-data'
import { getQuadrant } from '@/lib/utils'
import type { MonthlyStats, MonthBucket } from '@/types'

/**
 * Completion volume per month plus a review of one month, read from one
 * filtered set so the bar a reader clicks and the numbers below it can never
 * tell different stories. Shared by the API route and the server-rendered
 * review page.
 */

const MONTH_RE = /^(\d{4})-(\d{2})$/

/** Local-time month key, so a month boundary means what the user's clock says. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** First day of the month named by `YYYY-MM`; the current month when unparseable. */
export function parseMonthKey(raw: string | null | undefined): Date {
  const m = raw ? MONTH_RE.exec(raw) : null
  const now = new Date()
  if (!m) return new Date(now.getFullYear(), now.getMonth(), 1)
  return new Date(Number(m[1]), Number(m[2]) - 1, 1)
}

export interface MonthlyStatsOptions {
  month?: string | null
  months?: number
  /** CalendarAccount id, `none` for tasks with no calendar behind them, or unset for everything. */
  accountId?: string | null
  /** Sub-calendar (external id) — only meaningful together with an accountId. */
  calendarId?: string | null
}

/**
 * When a task was finished. `completedAt` is written by the API on every
 * completion, but rows completed before that landed only carry `updatedAt` —
 * close enough to place them in a month, and better than dropping them.
 */
function completionDate(t: { completedAt: Date | null; updatedAt: Date }): Date {
  return t.completedAt ?? t.updatedAt
}

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function loadMonthlyStats(userId: string, opts: MonthlyStatsOptions = {}): Promise<MonthlyStats> {
  const monthStart = parseMonthKey(opts.month)
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)
  const monthCount = Math.min(Math.max(opts.months ?? 12, 3), 24)
  const rangeStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - (monthCount - 1), 1)

  // Empty buckets first: a month with nothing in it still has to appear on the
  // chart, otherwise the axis silently skips it and the trend lies.
  const buckets = new Map<string, MonthBucket>()
  for (let i = 0; i < monthCount; i++) {
    const d = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i, 1)
    buckets.set(monthKey(d), { key: monthKey(d), completed: 0, due: 0 })
  }

  if (isDemoUser(userId)) return demoStats(monthStart, [...buckets.values()])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scope: Record<string, any> = { userId }
  if (opts.accountId === 'none') scope.calendarAccountId = null
  else if (opts.accountId) {
    scope.calendarAccountId = opts.accountId
    if (opts.calendarId) scope.calendarId = opts.calendarId
  }

  const [tasks, habitCompletions] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...scope,
        status: { not: 'CANCELLED' },
        OR: [
          { completedAt: { gte: rangeStart, lt: monthEnd } },
          { completedAt: null, status: 'COMPLETED', updatedAt: { gte: rangeStart, lt: monthEnd } },
          { deadline: { gte: rangeStart, lt: monthEnd } },
        ],
      },
      select: {
        id: true, title: true, status: true, deadline: true, completedAt: true, updatedAt: true,
        importance: true, urgency: true, parentTaskId: true,
      },
    }),
    prisma.habitCompletion.count({
      where: { habit: { userId }, completedAt: { gte: monthStart, lt: monthEnd } },
    }),
  ])

  const byQuadrant: MonthlyStats['summary']['byQuadrant'] = {
    'do-first': 0, schedule: 0, delegate: 0, eliminate: 0,
  }
  const completedByDay = new Map<string, number>()
  const completedTasks: MonthlyStats['completedTasks'] = []
  let due = 0
  let stillOpen = 0
  let openOverdue = 0
  const now = new Date()

  for (const t of tasks) {
    if (t.status === 'COMPLETED') {
      const done = completionDate(t)
      const doneBucket = buckets.get(monthKey(done))
      if (doneBucket) doneBucket.completed++
      if (done >= monthStart && done < monthEnd) {
        byQuadrant[getQuadrant(t.importance, t.urgency)]++
        const day = dayKeyOf(done)
        completedByDay.set(day, (completedByDay.get(day) ?? 0) + 1)
        completedTasks.push({
          id: t.id,
          title: t.title,
          completedAt: done.toISOString(),
          importance: t.importance,
          urgency: t.urgency,
          isSubTask: !!t.parentTaskId,
        })
      }
    }

    if (t.deadline) {
      const bucket = buckets.get(monthKey(t.deadline))
      if (bucket) bucket.due++
      if (t.deadline >= monthStart && t.deadline < monthEnd) {
        due++
        if (t.status !== 'COMPLETED') {
          stillOpen++
          if (t.deadline < now) openOverdue++
        }
      }
    }
  }

  completedTasks.sort((a, b) => b.completedAt.localeCompare(a.completedAt))

  const months = [...buckets.values()]
  const key = monthKey(monthStart)
  const idx = months.findIndex((m) => m.key === key)
  const bestDay = [...completedByDay.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]

  return {
    months,
    summary: {
      key,
      completed: months[idx]?.completed ?? 0,
      previousCompleted: idx > 0 ? months[idx - 1].completed : null,
      due,
      stillOpen,
      openOverdue,
      // Of everything due this month, how much is done. Tasks finished this
      // month whose deadline sits elsewhere (or is missing) are not part of it.
      completionRate: due > 0 ? Math.round(((due - stillOpen) / due) * 100) : null,
      activeDays: completedByDay.size,
      bestDay: bestDay ? { date: bestDay[0], count: bestDay[1] } : null,
      habitCompletions,
      byQuadrant,
    },
    completedTasks,
  }
}

/** The demo account has no rows in the database — shape its sample tasks the same way. */
function demoStats(monthStart: Date, months: MonthBucket[]): MonthlyStats {
  const demo = getDemoTasks()
  const done = demo.filter((t) => t.status === 'COMPLETED')
  const filled = months.map((m, i) => ({
    ...m,
    completed: i === months.length - 1 ? done.length + 2 : Math.max(0, 7 - Math.abs(months.length - 4 - i) * 2),
    due: Math.max(done.length, demo.length - i),
  }))
  const last = filled[filled.length - 1]
  return {
    months: filled,
    summary: {
      key: monthKey(monthStart),
      completed: last.completed,
      previousCompleted: filled.length > 1 ? filled[filled.length - 2].completed : null,
      due: demo.length,
      stillOpen: demo.length - done.length,
      openOverdue: 1,
      completionRate: Math.round((done.length / demo.length) * 100),
      activeDays: Math.max(done.length, 1),
      bestDay: { date: dayKeyOf(new Date()), count: 2 },
      habitCompletions: 12,
      byQuadrant: { 'do-first': 1, schedule: 1, delegate: 0, eliminate: 0 },
    },
    completedTasks: done.map((t) => ({
      id: t.id,
      title: t.title,
      completedAt: new Date().toISOString(),
      importance: t.importance,
      urgency: t.urgency,
      isSubTask: false,
    })),
  }
}
