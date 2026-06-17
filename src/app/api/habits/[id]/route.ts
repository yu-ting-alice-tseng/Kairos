import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createGoogleEvent } from '@/lib/calendar/google'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // If calendarAccountId changed or is newly set, create a calendar event for today
  if (body.calendarAccountId && body.calendarId) {
    const existing = await prisma.habit.findFirst({ where: { id, userId: session.user.id } })
    if (!existing?.calendarEventId || existing.calendarAccountId !== body.calendarAccountId) {
      try {
        const account = await prisma.calendarAccount.findFirst({
          where: { id: body.calendarAccountId, userId: session.user.id },
        })
        if (account?.accessToken) {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const tomorrow = new Date(today)
          tomorrow.setDate(tomorrow.getDate() + 1)
          body.calendarEventId = await createGoogleEvent(
            account.id,
            account.accessToken,
            body.calendarId,
            { title: body.title ?? existing?.title ?? '', allDay: true, start: today, end: tomorrow },
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
    data: body,
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
