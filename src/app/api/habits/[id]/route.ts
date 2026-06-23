import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createGoogleEvent } from '@/lib/calendar/google'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Sanitize: only keep known Prisma Habit scalar fields
  const allowedFields = ['title', 'description', 'color', 'icon', 'frequency', 'targetDays', 'scheduledTime', 'durationMinutes', 'calendarAccountId', 'calendarId', 'calendarEventId', 'isActive', 'streak', 'longestStreak']
  const data: Record<string, unknown> = Object.fromEntries(Object.entries(body).filter(([k]) => allowedFields.includes(k)))

  // If calendarAccountId changed or is newly set, recreate the recurring calendar event
  if (data.calendarAccountId && data.calendarId) {
    const existing = await prisma.habit.findFirst({ where: { id, userId: session.user.id } })
    if (!existing?.calendarEventId || existing.calendarAccountId !== data.calendarAccountId) {
      try {
        const account = await prisma.calendarAccount.findFirst({
          where: { id: data.calendarAccountId as string, userId: session.user.id },
        })
        if (account?.accessToken) {
          const frequency = (data.frequency ?? existing?.frequency ?? 'DAILY') as string
          const rruleMap: Record<string, string> = {
            DAILY: 'RRULE:FREQ=DAILY',
            WEEKDAYS: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
            WEEKENDS: 'RRULE:FREQ=WEEKLY;BYDAY=SA,SU',
            WEEKLY: 'RRULE:FREQ=WEEKLY',
            CUSTOM: 'RRULE:FREQ=DAILY',
          }
          const recurrence = [rruleMap[frequency] ?? 'RRULE:FREQ=DAILY']

          const scheduledTime = (data.scheduledTime ?? existing?.scheduledTime) as string | undefined
          const durationMinutes = (data.durationMinutes ?? existing?.durationMinutes ?? 30) as number
          const today = new Date()
          let start: Date, end: Date, allDay: boolean
          if (scheduledTime) {
            const [h, m] = scheduledTime.split(':').map(Number)
            start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m)
            end = new Date(start.getTime() + durationMinutes * 60000)
            allDay = false
          } else {
            start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
            end = new Date(start); end.setDate(end.getDate() + 1)
            allDay = true
          }

          data.calendarEventId = await createGoogleEvent(
            account.id,
            account.accessToken,
            data.calendarId as string,
            { title: (data.title ?? existing?.title ?? '') as string, allDay, start, end, recurrence },
            account.refreshToken,
            account.expiresAt
          )
        }
      } catch (err) {
        console.error('Failed to create habit calendar event:', err)
      }
    }
  }

  const habit = await prisma.habit.update({
    where: { id, userId: session.user.id },
    data,
  })

  return NextResponse.json(habit)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.habit.update({
    where: { id, userId: session.user.id },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
