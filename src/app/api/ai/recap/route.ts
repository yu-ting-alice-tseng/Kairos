import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getRequestTimeZone } from '@/lib/timezone-server'
import { zonedDayRange } from '@/lib/timezones'
import { generateDailyRecap } from '@/lib/ai'
import { prisma } from '@/lib/prisma'
import { parseRoutinePatterns, isRoutineTitle } from '@/lib/routine'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lang } = await req.json().catch(() => ({ lang: 'fr' }))

  const { start: today, end: todayEnd } = zonedDayRange(await getRequestTimeZone())

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const [openTasks, completedYesterday, missedYesterdayAll, owner] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: session.user.id,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        parentTaskId: null,
      },
      orderBy: { priority: 'desc' },
      take: 40,
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
    prisma.user.findUnique({ where: { id: session.user.id }, select: { routinePatterns: true } }),
  ])

  // Routine slots (shower…) left undone are not misses, and once their day has
  // passed they are not today's work either.
  const routinePatterns = parseRoutinePatterns(owner?.routinePatterns)
  const isPastRoutine = (t: { title: string; scheduledStart: Date | null; deadline: Date | null }) => {
    if (!isRoutineTitle(t.title, routinePatterns)) return false
    const when = t.scheduledStart ?? t.deadline
    return !!when && when < today
  }
  const todayTasks = openTasks.filter((t) => !isPastRoutine(t)).slice(0, 10)
  const missedYesterday = missedYesterdayAll.filter((t) => !isRoutineTitle(t.title, routinePatterns))

  try {
    const summary = await generateDailyRecap(
      todayTasks as never,
      completedYesterday as never,
      missedYesterday as never,
      (lang ?? 'fr') as 'fr' | 'en' | 'zh'
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
