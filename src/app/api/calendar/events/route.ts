import { NextRequest, NextResponse, after } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listGoogleEvents, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent, moveGoogleEvent } from '@/lib/calendar/google'
import { listOutlookEvents } from '@/lib/calendar/outlook'
import { listNotionEvents } from '@/lib/calendar/notion'
import { CalendarEvent } from '@/types'
import { calculatePriority } from '@/lib/utils'
import { z } from 'zod'

const eventPostSchema = z.object({
  calendarAccountId: z.string().min(1),
  calendarId: z.string().optional(),
  title: z.string().min(1).max(1000),
  description: z.string().max(10000).optional(),
  start: z.string().min(1),
  end: z.string().optional(),
  allDay: z.boolean().optional(),
})
const eventPatchSchema = z.object({
  eventId: z.string().min(1),
  calendarAccountId: z.string().min(1),
  calendarId: z.string().optional(),
  action: z.string().optional(),
  destinationCalendarId: z.string().optional(),
  title: z.string().min(1).max(1000).optional(),
  description: z.string().max(10000).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  allDay: z.boolean().optional(),
})
const eventDeleteSchema = z.object({
  eventId: z.string().min(1),
  calendarAccountId: z.string().min(1),
  calendarId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const startParam = searchParams.get('start')
  const endParam = searchParams.get('end')
  const noSync = searchParams.get('noSync') === 'true'
  if (!startParam || !endParam) {
    return NextResponse.json({ error: 'start and end query params required' }, { status: 400 })
  }

  const timeMin = new Date(startParam)
  const timeMax = new Date(endParam)
  if (isNaN(timeMin.getTime()) || isNaN(timeMax.getTime())) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }

  // Load ALL sub-calendars (active + inactive) so we can detect accounts with inactive calendars
  const accounts = await prisma.calendarAccount.findMany({
    where: { userId, isActive: true },
    include: { subCalendars: true },
  })

  const allEvents: CalendarEvent[] = []

  // Track which (accountId:calendarId) pairs fetched successfully
  // Used later to determine which accounts are safe for orphan deletion
  const successfulFetches = new Set<string>()

  await Promise.all(
    accounts.map(async (account) => {
      if (account.provider !== 'GOOGLE' && account.provider !== 'OUTLOOK' && account.provider !== 'NOTION') return

      const accessToken = account.accessToken
      const refreshToken = account.refreshToken
      const expiresAt = account.expiresAt
      if (!accessToken) return

      const activeSubCals = account.subCalendars.filter((sc) => sc.isActive)
      // Only fall back to primary when no sub-calendar records exist at all (account never configured).
      // If records exist but all are inactive, the user explicitly disabled them — fetch nothing.
      const calendarIds = account.subCalendars.length === 0
        ? [{ id: account.provider === 'GOOGLE' ? 'primary' : null, color: account.color }]
        : activeSubCals.map((sc) => ({ id: sc.externalId, color: sc.color }))

      await Promise.all(
        calendarIds
          .filter((c) => c.id !== null)
          .map(async ({ id, color }) => {
            try {
              let events: CalendarEvent[] = []

              if (account.provider === 'GOOGLE') {
                events = await listGoogleEvents(account.id, accessToken, id!, timeMin, timeMax, refreshToken, expiresAt)
                events = events.map((e) => ({ ...e, editable: true }))
              } else if (account.provider === 'OUTLOOK') {
                events = await listOutlookEvents(accessToken, id!, timeMin, timeMax)
              } else if (account.provider === 'NOTION') {
                events = await listNotionEvents(accessToken, id!, timeMin, timeMax)
              }

              events.forEach((e) =>
                allEvents.push({
                  ...e,
                  calendarAccountId: account.id,
                  calendarId: id!,
                  color,
                })
              )
              successfulFetches.add(`${account.id}:${id}`)
            } catch (err) {
              console.error(`Failed to fetch events for account ${account.id}, calendar ${id}:`, err)
            }
          })
      )
    })
  )

  // Determine which accounts are safe for orphan deletion:
  // - All active sub-calendars must have fetched successfully (handles case 4: API/token errors)
  // - Account must have NO inactive sub-calendars (handles case 3: event may be on a disabled calendar)
  const safeToOrphanDeleteAccountIds = new Set(
    accounts
      .filter((account) => {
        const hasInactiveSubCals = account.subCalendars.some((sc) => !sc.isActive)
        if (hasInactiveSubCals) return false
        const activeSubCals = account.subCalendars.filter((sc) => sc.isActive)
        const expectedIds = activeSubCals.length > 0
          ? activeSubCals.map((sc) => sc.externalId)
          : [account.provider === 'GOOGLE' ? 'primary' : null].filter(Boolean) as string[]
        return expectedIds.every((calId) => successfulFetches.has(`${account.id}:${calId}`))
      })
      .map((a) => a.id)
  )

  // Sync tasks with fetched calendar events (non-habit events only)
  // Skip when noSync=true (e.g. link dialog — read-only display, must not delete tasks)
  // Deduplicate events by id — same event can appear from duplicate CalendarAccount rows
  const seenEventIds = new Set<string>()
  const dedupedEvents = allEvents.filter((e) => {
    if (seenEventIds.has(e.id)) return false
    seenEventIds.add(e.id)
    return true
  })

  if (noSync) return NextResponse.json(dedupedEvents)
  try {
    const syncableEvents = dedupedEvents.filter((e) => !e.habitId)
    const syncEventIds = syncableEvents.map((e) => e.id)

    const existingTasks = await prisma.task.findMany({
      where: { userId, calendarEventId: { in: syncEventIds } },
      select: { id: true, calendarEventId: true, title: true, deadline: true, calendarAccountId: true, importance: true, urgency: true, parentTaskId: true },
    })

    // Determine which tasks are chain parents (other tasks point to them)
    const taskIdSet = new Set(existingTasks.map((t) => t.id))
    const chainParentIds = new Set(
      existingTasks.filter((t) => t.parentTaskId && taskIdSet.has(t.parentTaskId)).map((t) => t.parentTaskId!)
    )

    // Deduplicate: if multiple tasks share the same calendarEventId, keep the most valuable one
    function taskValue(t: typeof existingTasks[number]): number {
      let score = 0
      if (chainParentIds.has(t.id)) score += 100   // is a chain parent
      if (t.parentTaskId) score += 50               // is in a chain
      if (t.importance !== 5 || t.urgency !== 5) score += 10  // user-configured
      return score
    }
    const byEventId = new Map<string, typeof existingTasks[number]>()
    const dupeIds: string[] = []
    for (const t of existingTasks) {
      const key = t.calendarEventId!
      const existing = byEventId.get(key)
      if (!existing) { byEventId.set(key, t); continue }
      if (taskValue(t) > taskValue(existing)) {
        dupeIds.push(existing.id)
        byEventId.set(key, t)
      } else {
        dupeIds.push(t.id)
      }
    }
    if (dupeIds.length > 0) {
      // Unlink children of tasks being deleted before removing them
      await prisma.task.updateMany({ where: { parentTaskId: { in: dupeIds }, userId }, data: { parentTaskId: null } })
      await prisma.task.deleteMany({ where: { id: { in: dupeIds }, userId } })
    }

    // Auto-create tasks for events that don't have one yet
    const toCreate = syncableEvents.filter((e) => !byEventId.has(e.id))
    for (const e of toCreate) {
      // Re-check just before creating to guard against concurrent requests
      const alreadyExists = await prisma.task.findFirst({ where: { userId, calendarEventId: e.id }, select: { id: true } })
      if (alreadyExists) continue
      const deadline = e.allDay ? new Date(e.start) : new Date(e.end)
      await prisma.task.create({
        data: {
          userId,
          title: e.title,
          calendarEventId: e.id,
          calendarAccountId: e.calendarAccountId ?? null,
          deadline,
          importance: 5,
          urgency: 5,
          priority: calculatePriority(5, 5),
          status: 'PENDING',
        },
      })
    }

    // Sync title / deadline / calendarAccountId from calendar event → task
    for (const e of syncableEvents) {
      const task = byEventId.get(e.id)
      if (!task) continue
      const evDeadline = e.allDay ? new Date(e.start) : new Date(e.end)
      const taskDeadline = task.deadline ? new Date(String(task.deadline)) : null
      const deadlineChanged = evDeadline.toDateString() !== taskDeadline?.toDateString()
      const titleChanged = e.title !== task.title
      const accountChanged = (e.calendarAccountId ?? null) !== task.calendarAccountId
      if (titleChanged || deadlineChanged || accountChanged) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: Record<string, any> = {}
        if (titleChanged) updateData.title = e.title
        if (deadlineChanged) updateData.deadline = evDeadline
        if (accountChanged) updateData.calendarAccountId = e.calendarAccountId ?? null
        await prisma.task.update({ where: { id: task.id }, data: updateData })
      }
    }

    // Remove duplicate siblings: same parentTaskId + same title + same deadline day
    const allSiblings = await prisma.task.findMany({
      where: { userId, parentTaskId: { not: null } },
      select: { id: true, parentTaskId: true, title: true, deadline: true },
      orderBy: { createdAt: 'asc' }, // keep oldest
    })
    const siblingKeyMap = new Map<string, string>()
    const siblingDupeIds: string[] = []
    for (const s of allSiblings) {
      const key = `${s.parentTaskId}|${s.title}|${s.deadline ? new Date(String(s.deadline)).toDateString() : 'none'}`
      if (siblingKeyMap.has(key)) {
        siblingDupeIds.push(s.id)
      } else {
        siblingKeyMap.set(key, s.id)
      }
    }
    if (siblingDupeIds.length > 0) {
      await prisma.task.updateMany({ where: { parentTaskId: { in: siblingDupeIds }, userId }, data: { parentTaskId: null } })
      await prisma.task.deleteMany({ where: { id: { in: siblingDupeIds }, userId } })
    }

    // Delete tasks whose linked event no longer exists in this window.
    // Only runs for accounts where we are certain we fetched ALL events:
    //   - All active sub-calendars returned successfully (no API/token errors)
    //   - Account has no inactive sub-calendars (event could be on a disabled calendar)
    if (safeToOrphanDeleteAccountIds.size > 0) {
      const fetchedEventIds = new Set(syncEventIds)
      const linkedInWindow = await prisma.task.findMany({
        where: {
          userId,
          calendarAccountId: { in: [...safeToOrphanDeleteAccountIds] },
          calendarEventId: { not: null },
          OR: [
            { scheduledStart: { gte: timeMin, lte: timeMax } },
            { scheduledStart: null, deadline: { gte: timeMin, lte: timeMax } },
            { scheduledStart: null, deadline: null },
          ],
        },
        select: { id: true, calendarEventId: true },
      })
      const orphanIds = linkedInWindow
        .filter((t) => t.calendarEventId && !fetchedEventIds.has(t.calendarEventId))
        .map((t) => t.id)
      if (orphanIds.length > 0) {
        await prisma.task.updateMany({ where: { parentTaskId: { in: orphanIds }, userId }, data: { parentTaskId: null } })
        await prisma.task.deleteMany({ where: { id: { in: orphanIds }, userId } })
      }
    }
  } catch (err) {
    console.error('[calendar/events] task sync failed:', err)
  }

  return NextResponse.json(dedupedEvents)
}

// POST — create a Google Calendar event and return its id
export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = eventPostSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { calendarAccountId, calendarId, title, description, start, end, allDay } = parsed.data

  const account = await prisma.calendarAccount.findFirst({
    where: { id: calendarAccountId, userId },
  })
  if (!account?.accessToken) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  if (account.provider === 'GOOGLE') {
    const startDate = new Date(start)
    const endDate = end ? new Date(end) : new Date(startDate.getTime() + 60 * 60 * 1000)
    const eventId = await createGoogleEvent(
      account.id,
      account.accessToken,
      calendarId ?? 'primary',
      { title, description, start: startDate, end: endDate, allDay: !!allDay },
      account.refreshToken,
      account.expiresAt
    )
    return NextResponse.json({ eventId })
  }

  return NextResponse.json({ error: 'Provider does not support creation' }, { status: 400 })
}

// PATCH — update a Google Calendar event
export async function PATCH(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = eventPatchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { eventId, calendarAccountId, calendarId, title, description, start, end, allDay, action, destinationCalendarId } = parsed.data

  const account = await prisma.calendarAccount.findFirst({
    where: { id: calendarAccountId, userId },
  })
  if (!account?.accessToken) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  // Move event to another sub-calendar within the same Google account
  if (action === 'move' && account.provider === 'GOOGLE') {
    const destId = destinationCalendarId ?? 'primary'
    if (destId !== 'primary') {
      const ownedDest = await prisma.subCalendar.findFirst({ where: { calendarAccountId: account.id, externalId: destId } })
      if (!ownedDest) return NextResponse.json({ error: 'Destination calendar not found' }, { status: 404 })
    }
    await moveGoogleEvent(account.id, account.accessToken, calendarId ?? 'primary', eventId, destId, account.refreshToken, account.expiresAt)
    return NextResponse.json({ ok: true })
  }

  // Verify the calendarId belongs to this account (prevents modifying events on foreign calendars)
  const resolvedCalendarId = calendarId ?? 'primary'
  if (resolvedCalendarId !== 'primary') {
    const ownedCal = await prisma.subCalendar.findFirst({ where: { calendarAccountId: account.id, externalId: resolvedCalendarId } })
    if (!ownedCal) return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })
  }

  if (account.provider === 'GOOGLE') {
    await updateGoogleEvent(
      account.id,
      account.accessToken,
      calendarId ?? 'primary',
      eventId,
      {
        title,
        description,
        start: start ? new Date(start) : undefined,
        end: end ? new Date(end) : undefined,
        allDay: !!allDay,
      },
      account.refreshToken,
      account.expiresAt
    )
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Provider does not support editing' }, { status: 400 })
}

// DELETE — delete a Google Calendar event
export async function DELETE(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = eventDeleteSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { eventId, calendarAccountId, calendarId } = parsed.data

  const account = await prisma.calendarAccount.findFirst({
    where: { id: calendarAccountId, userId },
  })
  if (!account?.accessToken) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  // Verify the calendarId belongs to this account
  const resolvedCalendarIdDel = calendarId ?? 'primary'
  if (resolvedCalendarIdDel !== 'primary') {
    const ownedCal = await prisma.subCalendar.findFirst({ where: { calendarAccountId: account.id, externalId: resolvedCalendarIdDel } })
    if (!ownedCal) return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })
  }

  if (account.provider === 'GOOGLE') {
    await deleteGoogleEvent(
      account.id,
      account.accessToken,
      calendarId ?? 'primary',
      eventId,
      account.refreshToken,
      account.expiresAt
    )
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Provider does not support deletion' }, { status: 400 })
}
