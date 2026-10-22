import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRequestTimeZone } from '@/lib/timezone-server'
import { zonedDayRange } from '@/lib/timezones'
import { isDemoUser, getDemoHabits } from '@/lib/demo-data'

// The demo serves fixed habits that are not in the database: answer as if the
// check-in worked, and keep nothing.
function demoStreak(habitId: string, delta: number) {
  const streak = getDemoHabits().find((h) => h.id === habitId)?.streak ?? 0
  return Math.max(0, streak + delta)
}

// DELETE — remove today's completion for a habit
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { habitId } = await req.json()
  if (isDemoUser(session.user.id)) return NextResponse.json({ success: true, streak: demoStreak(habitId, -1) })

  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId: session.user.id } })
  if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { start: todayStart, end: todayEnd } = zonedDayRange(await getRequestTimeZone())
  await prisma.habitCompletion.deleteMany({
    where: { habitId, completedAt: { gte: todayStart, lte: todayEnd } },
  })

  const newStreak = Math.max(0, habit.streak - 1)
  await prisma.habit.update({ where: { id: habitId }, data: { streak: newStreak } })

  return NextResponse.json({ success: true, streak: newStreak })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { habitId, notes } = await req.json()
  if (isDemoUser(session.user.id)) return NextResponse.json({ success: true, streak: demoStreak(habitId, 1) })

  const habit = await prisma.habit.findUnique({
    where: { id: habitId, userId: session.user.id },
    include: {
      completions: { orderBy: { completedAt: 'desc' }, take: 2 },
    },
  })
  if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.habitCompletion.create({
    data: { habitId, notes },
  })

  const { start: yesterdayStart, end: yesterdayEnd } = zonedDayRange(await getRequestTimeZone(), new Date(), -1)

  const hadYesterday = habit.completions.some(
    (c) => new Date(c.completedAt) >= yesterdayStart && new Date(c.completedAt) <= yesterdayEnd
  )

  const newStreak = hadYesterday ? habit.streak + 1 : 1
  const newLongest = Math.max(newStreak, habit.longestStreak)

  await prisma.habit.update({
    where: { id: habitId },
    data: { streak: newStreak, longestStreak: newLongest },
  })

  return NextResponse.json({ success: true, streak: newStreak })
}
