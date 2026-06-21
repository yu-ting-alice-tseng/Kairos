import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listGoogleEvents, updateGoogleEvent, deleteGoogleEvent } from '@/lib/calendar/google'
import { listOutlookEvents } from '@/lib/calendar/outlook'
import { listNotionEvents } from '@/lib/calendar/notion'
import { CalendarEvent } from '@/types'

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const startParam = searchParams.get('start')
  const endParam = searchParams.get('end')
  if (!startParam || !endParam) {
    return NextResponse.json({ error: 'start and end query params required' }, { status: 400 })
  }

  const timeMin = new Date(startParam)
  const timeMax = new Date(endParam)

  const accounts = await prisma.calendarAccount.findMany({
    where: { userId, isActive: true },
    include: { subCalendars: { where: { isActive: true } } },
  })

  const allEvents: CalendarEvent[] = []

  await Promise.all(
    accounts.map(async (account) => {
      if (account.provider !== 'GOOGLE' && account.provider !== 'OUTLOOK' && account.provider !== 'NOTION') return

      const accessToken = account.accessToken
      const refreshToken = account.refreshToken
      const expiresAt = account.expiresAt
      if (!accessToken) return

      const calendarIds = account.subCalendars.length > 0
        ? account.subCalendars.map((sc) => ({ id: sc.externalId, color: sc.color }))
        : [{ id: account.provider === 'GOOGLE' ? 'primary' : null, color: account.color }]

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
            } catch (err) {
              console.error(`Failed to fetch events for account ${account.id}, calendar ${id}:`, err)
            }
          })
      )
    })
  )

  // Delete tasks whose linked calendar event no longer exists in this time window.
  // Only checks tasks that have both calendarEventId and scheduledStart within the range.
  try {
    const fetchedEventIds = new Set(allEvents.map((e) => e.id))
    const linkedTasks = await prisma.task.findMany({
      where: {
        userId,
        calendarEventId: { not: null },
        scheduledStart: { gte: timeMin, lte: timeMax },
      },
      select: { id: true, calendarEventId: true },
    })
    const orphanIds = linkedTasks
      .filter((t) => t.calendarEventId && !fetchedEventIds.has(t.calendarEventId))
      .map((t) => t.id)
    if (orphanIds.length > 0) {
      await prisma.task.deleteMany({ where: { id: { in: orphanIds } } })
    }
  } catch (err) {
    console.error('[calendar/events] orphan task cleanup failed:', err)
  }

  return NextResponse.json(allEvents)
}

// PATCH — update a Google Calendar event
export async function PATCH(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { eventId, calendarAccountId, calendarId, title, description, start, end } = await req.json()

  const account = await prisma.calendarAccount.findFirst({
    where: { id: calendarAccountId, userId },
  })
  if (!account?.accessToken) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

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

  const { eventId, calendarAccountId, calendarId } = await req.json()

  const account = await prisma.calendarAccount.findFirst({
    where: { id: calendarAccountId, userId },
  })
  if (!account?.accessToken) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

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
