import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDemoUser, getDemoHabits } from '@/lib/demo-data'
import { createGoogleEvent } from '@/lib/calendar/google'
import { z } from 'zod'

const createHabitSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  color: z.string().default('#10B981'),
  icon: z.string().optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'WEEKDAYS', 'WEEKENDS', 'CUSTOM']).default('DAILY'),
  targetDays: z.string().optional(),
  scheduledTime: z.string().optional(),
  durationMinutes: z.number().optional(),
  calendarAccountId: z.string().optional(),
  calendarId: z.string().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (isDemoUser(session.user.id)) return NextResponse.json(getDemoHabits())

  const habits = await prisma.habit.findMany({
    where: { userId: session.user.id, isActive: true },
    include: {
      completions: {
        where: {
          completedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(habits)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createHabitSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  let calendarEventId: string | undefined

  if (parsed.data.calendarAccountId && parsed.data.calendarId) {
    try {
      const account = await prisma.calendarAccount.findFirst({
        where: { id: parsed.data.calendarAccountId, userId: session.user.id },
      })
      if (account?.accessToken) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        calendarEventId = await createGoogleEvent(
          account.id,
          account.accessToken,
          parsed.data.calendarId,
          { title: parsed.data.title, allDay: true, start: today, end: tomorrow },
          account.refreshToken,
          account.expiresAt
        )
      }
    } catch (err) {
      console.error('Failed to create habit calendar event:', err)
    }
  }

  const habit = await prisma.habit.create({
    data: { userId: session.user.id, ...parsed.data, ...(calendarEventId ? { calendarEventId } : {}) },
  })

  return NextResponse.json(habit, { status: 201 })
}
