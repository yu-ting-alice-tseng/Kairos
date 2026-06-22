import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { habitId, notes } = await req.json()

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

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStart = new Date(yesterday.setHours(0, 0, 0, 0))
  const yesterdayEnd = new Date(yesterday.setHours(23, 59, 59, 999))

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
