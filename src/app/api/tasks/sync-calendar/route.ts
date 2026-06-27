import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listGoogleEvents } from '@/lib/calendar/google'
import { CalendarEvent } from '@/types'
import { calculatePriority } from '@/lib/utils'

/**
 * POST /api/tasks/sync-calendar
 * Syncs task titles, deadlines and calendarAccountId from Google Calendar
 * for all tasks that have a calendarEventId. Call this from any page
 * that displays tasks so renames/date changes in Google Calendar are
 * reflected immediately without having to visit the Calendar page.
 */
export async function POST() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Find all linked tasks and determine their date range
    const linkedTasks = await prisma.task.findMany({
      where: { userId, calendarEventId: { not: null } },
      select: { id: true, calendarEventId: true, calendarAccountId: true, title: true, deadline: true, importance: true, urgency: true, parentTaskId: true },
    })
    if (linkedTasks.length === 0) return NextResponse.json({ synced: 0 })

    const deadlines = linkedTasks
      .map((t) => t.deadline ? new Date(String(t.deadline)).getTime() : null)
      .filter((d): d is number => d !== null)
    if (deadlines.length === 0) return NextResponse.json({ synced: 0 })

    const timeMin = new Date(Math.min(...deadlines) - 86400_000) // 1 day before earliest
    const timeMax = new Date(Math.max(...deadlines) + 86400_000) // 1 day after latest

    // Fetch calendar events for that range across all active accounts
    const accounts = await prisma.calendarAccount.findMany({
      where: { userId, isActive: true, provider: 'GOOGLE' },
      include: { subCalendars: { where: { isActive: true } } },
    })

    const allEvents: CalendarEvent[] = []
    await Promise.all(accounts.map(async (account) => {
      if (!account.accessToken) return
      const calendarIds = account.subCalendars.length > 0
        ? account.subCalendars.map((sc) => sc.externalId)
        : ['primary']
      await Promise.all(calendarIds.map(async (calId) => {
        try {
          const evs = await listGoogleEvents(
            account.id, account.accessToken!, calId, timeMin, timeMax,
            account.refreshToken, account.expiresAt,
          )
          evs.forEach((e) => allEvents.push({ ...e, calendarAccountId: account.id }))
        } catch { /* ignore per-calendar errors */ }
      }))
    }))

    const eventById = new Map(allEvents.map((e) => [e.id, e]))

    // Determine which tasks are chain parents
    const taskIdSet = new Set(linkedTasks.map((t) => t.id))
    const chainParentIds = new Set(
      linkedTasks.filter((t) => t.parentTaskId && taskIdSet.has(t.parentTaskId)).map((t) => t.parentTaskId!)
    )

    function taskValue(t: typeof linkedTasks[number]): number {
      let score = 0
      if (chainParentIds.has(t.id)) score += 100
      if (t.parentTaskId) score += 50
      if (t.importance !== 5 || t.urgency !== 5) score += 10
      return score
    }

    // Deduplicate: keep the most valuable task per calendarEventId
    const byEventId = new Map<string, typeof linkedTasks[number]>()
    const dupeIds: string[] = []
    for (const t of linkedTasks) {
      const key = t.calendarEventId!
      const existing = byEventId.get(key)
      if (!existing) { byEventId.set(key, t); continue }
      if (taskValue(t) > taskValue(existing)) {
        dupeIds.push(existing.id); byEventId.set(key, t)
      } else {
        dupeIds.push(t.id)
      }
    }
    if (dupeIds.length > 0) {
      await prisma.task.updateMany({ where: { parentTaskId: { in: dupeIds }, userId }, data: { parentTaskId: null } })
      await prisma.task.deleteMany({ where: { id: { in: dupeIds }, userId } })
    }

    // Sync title / deadline from calendar event → task
    let synced = 0
    for (const [eventId, task] of byEventId) {
      const ev = eventById.get(eventId)
      if (!ev) continue // event not in this range or deleted
      const evDeadline = ev.allDay ? new Date(ev.start) : new Date(ev.end)
      const taskDeadline = task.deadline ? new Date(String(task.deadline)) : null
      const titleChanged = ev.title !== task.title
      const deadlineChanged = evDeadline.toDateString() !== taskDeadline?.toDateString()
      const accountChanged = (ev.calendarAccountId ?? null) !== task.calendarAccountId
      if (titleChanged || deadlineChanged || accountChanged) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: Record<string, any> = {}
        if (titleChanged) data.title = ev.title
        if (deadlineChanged) data.deadline = evDeadline
        if (accountChanged) data.calendarAccountId = ev.calendarAccountId ?? null
        await prisma.task.update({ where: { id: task.id }, data })
        synced++
      }
    }

    // Auto-create tasks for events whose tasks don't exist yet (missed events in range)
    const missingEvents = allEvents.filter((e) => !e.habitId && !byEventId.has(e.id))
    for (const e of missingEvents) {
      const existingCheck = await prisma.task.findFirst({ where: { userId, calendarEventId: e.id }, select: { id: true } })
      if (existingCheck) continue
      const deadline = e.allDay ? new Date(e.start) : new Date(e.end)
      await prisma.task.create({
        data: {
          userId, title: e.title, calendarEventId: e.id,
          calendarAccountId: e.calendarAccountId ?? null, deadline,
          importance: 5, urgency: 5, priority: calculatePriority(5, 5), status: 'PENDING',
        },
      })
    }

    return NextResponse.json({ synced, dupes: dupeIds.length })
  } catch (err) {
    console.error('[tasks/sync-calendar]', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
