import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { isDemoUser, getDemoTasks } from '@/lib/demo-data'

// Widget tokens are HMAC-signed with AUTH_SECRET so the read-only widget API
// can authenticate without a session cookie and without any schema change.
// Rotating AUTH_SECRET invalidates every widget URL (same blast radius as sessions).

const DEFAULT_TZ = 'Asia/Taipei'

function getSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return secret
}

export function createWidgetToken(userId: string): string {
  const payload = Buffer.from(userId, 'utf8').toString('base64url')
  const sig = createHmac('sha256', getSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyWidgetToken(token: string): string | null {
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expected = createHmac('sha256', getSecret()).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    return Buffer.from(payload, 'base64url').toString('utf8')
  } catch {
    return null
  }
}

export interface WidgetTask {
  id: string
  title: string
  status: string
  priority: number
  scheduledStart: string | null
  scheduledEnd: string | null
  deadline: string | null
  estimatedMinutes: number | null
  overdue: boolean
}

export interface WidgetData {
  date: string
  timezone: string
  generatedAt: string
  tasks: WidgetTask[]
  completedCount: number
  totalCount: number
}

function getDayBounds(tz: string) {
  const now = new Date()
  // en-CA gives YYYY-MM-DD; longOffset gives "GMT+08:00" (or bare "GMT" for UTC)
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now)
  const tzName = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(now)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const offset = tzName.match(/GMT([+-]\d{2}:\d{2})/)?.[1] ?? '+00:00'
  return {
    dateStr,
    start: new Date(`${dateStr}T00:00:00.000${offset}`),
    end: new Date(`${dateStr}T23:59:59.999${offset}`),
  }
}

type TaskRecord = {
  id: string
  title: string
  status: string
  priority: number
  scheduledStart: Date | null
  scheduledEnd: Date | null
  deadline: Date | null
  completedAt: Date | null
  estimatedMinutes: number | null
}

const MAX_TASKS = 20

export async function getWidgetData(userId: string, tzParam?: string): Promise<WidgetData> {
  let tz = tzParam || DEFAULT_TZ
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz })
  } catch {
    tz = DEFAULT_TZ
  }
  const { dateStr, start, end } = getDayBounds(tz)

  // Same conditions as the DB query below — used for the demo dataset
  const isToday = (t: TaskRecord) => {
    if (t.status === 'COMPLETED') return !!t.completedAt && t.completedAt >= start && t.completedAt <= end
    if (t.scheduledStart) return t.scheduledStart >= start && t.scheduledStart <= end
    if (t.deadline) return t.deadline <= end
    return true
  }

  let records: TaskRecord[]
  if (isDemoUser(userId)) {
    records = getDemoTasks().filter(isToday)
  } else {
    // Mirrors the "today" view: scheduled today, due today or overdue,
    // unscheduled backlog, plus tasks completed today (for the progress count).
    records = await prisma.task.findMany({
      where: {
        userId,
        parentTaskId: null,
        OR: [
          { status: { in: ['PENDING', 'IN_PROGRESS'] }, scheduledStart: { gte: start, lte: end } },
          { status: { in: ['PENDING', 'IN_PROGRESS'] }, deadline: { lte: end } },
          { status: { in: ['PENDING', 'IN_PROGRESS'] }, scheduledStart: null, deadline: null },
          { status: 'COMPLETED', completedAt: { gte: start, lte: end } },
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })
  }

  const pending = records.filter((t) => t.status !== 'COMPLETED')
  const completedCount = records.length - pending.length

  // Timed tasks first (by start time), then the rest by priority
  pending.sort((a, b) => {
    if (a.scheduledStart && b.scheduledStart) return a.scheduledStart.getTime() - b.scheduledStart.getTime()
    if (a.scheduledStart) return -1
    if (b.scheduledStart) return 1
    return b.priority - a.priority
  })

  const tasks: WidgetTask[] = pending.slice(0, MAX_TASKS).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    scheduledStart: t.scheduledStart?.toISOString() ?? null,
    scheduledEnd: t.scheduledEnd?.toISOString() ?? null,
    deadline: t.deadline?.toISOString() ?? null,
    estimatedMinutes: t.estimatedMinutes,
    overdue: !!t.deadline && t.deadline.getTime() < start.getTime(),
  }))

  return {
    date: dateStr,
    timezone: tz,
    generatedAt: new Date().toISOString(),
    tasks,
    completedCount,
    totalCount: completedCount + pending.length,
  }
}
