import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { breakdownTask } from '@/lib/ai'
import { prisma } from '@/lib/prisma'
import { calculatePriority } from '@/lib/utils'
import { z } from 'zod'

const breakdownSchema = z.object({
  title: z.string().min(1).max(1000),
  taskId: z.string().optional(),
  description: z.string().max(5000).optional(),
  deadline: z.string().max(100).optional(),
  totalHours: z.number().min(0).max(10000).optional(),
  lang: z.string().max(10).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = breakdownSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { taskId, title, description, deadline, totalHours, lang } = parsed.data

  try {
    const result = await breakdownTask(
      title,
      description ?? '',
      deadline ?? 'non définie',
      totalHours ?? 2,
      (lang ?? 'fr') as 'fr' | 'en' | 'zh'
    )

    if (taskId) {
      const task = await prisma.task.findUnique({ where: { id: taskId, userId: session.user.id } })
      if (task) {
        await prisma.task.updateMany({
          where: { parentTaskId: taskId },
          data: { status: 'CANCELLED' },
        })

        for (const sub of result.subTasks) {
          await prisma.task.create({
            data: {
              userId: session.user.id,
              parentTaskId: taskId,
              title: sub.title,
              description: sub.description,
              estimatedMinutes: sub.estimatedMinutes,
              deadline: sub.scheduledDate ? new Date(sub.scheduledDate) : task.deadline,
              importance: sub.importance,
              urgency: sub.urgency,
              priority: calculatePriority(sub.importance, sub.urgency),
              aiSuggested: true,
              calendarAccountId: task.calendarAccountId,
            },
          })
        }
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('AI breakdown error:', err)
    return NextResponse.json({ error: 'AI error' }, { status: 500 })
  }
}
