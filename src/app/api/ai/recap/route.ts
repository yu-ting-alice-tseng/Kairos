import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateDailyRecap } from '@/lib/ai'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lang } = await req.json().catch(() => ({ lang: 'fr' }))

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const [todayTasks, completedYesterday, missedYesterday] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: session.user.id,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        parentTaskId: null,
      },
      orderBy: { priority: 'desc' },
      take: 10,
    }),
    prisma.task.findMany({
      where: {
        userId: session.user.id,
        status: 'COMPLETED',
        completedAt: { gte: yesterday, lt: today },
      },
    }),
    prisma.task.findMany({
      where: {
        userId: session.user.id,
        status: 'MISSED',
        scheduledEnd: { gte: yesterday, lt: today },
      },
    }),
  ])

  try {
    const summary = await generateDailyRecap(
      todayTasks as never,
      completedYesterday as never,
      missedYesterday as never,
      lang ?? 'fr'
    )

    await prisma.dailyRecap.create({
      data: {
        userId: session.user.id,
        date: new Date(),
        summary,
        tasksTotal: todayTasks.length,
        tasksDone: completedYesterday.length,
        tasksMissed: missedYesterday.length,
      },
    })

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('Recap error:', err)
    return NextResponse.json({ error: 'AI error' }, { status: 500 })
  }
}
