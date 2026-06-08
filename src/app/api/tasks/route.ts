import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculatePriority } from '@/lib/utils'
import { z } from 'zod'

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  importance: z.number().min(1).max(10).default(5),
  urgency: z.number().min(1).max(10).default(5),
  estimatedMinutes: z.number().optional(),
  deadline: z.string().optional(),
  calendarAccountId: z.string().optional(),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
  parentTaskId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const date = searchParams.get('date')

  const where: Record<string, unknown> = { userId: session.user.id }
  if (status) where.status = status
  if (date) {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)
    where.OR = [
      { scheduledStart: { gte: start, lte: end } },
      { deadline: { gte: start, lte: end } },
      { scheduledStart: null, deadline: null, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    ]
  }

  const tasks = await prisma.task.findMany({
    where,
    include: { subTasks: true, calendarAccount: true },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createTaskSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const data = parsed.data
  const priority = calculatePriority(data.importance, data.urgency)

  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      title: data.title,
      description: data.description,
      importance: data.importance,
      urgency: data.urgency,
      priority,
      estimatedMinutes: data.estimatedMinutes,
      deadline: data.deadline ? new Date(data.deadline) : undefined,
      calendarAccountId: data.calendarAccountId,
      scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : undefined,
      scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : undefined,
      notes: data.notes,
      tags: data.tags,
      parentTaskId: data.parentTaskId,
    },
    include: { subTasks: true, calendarAccount: true },
  })

  return NextResponse.json(task, { status: 201 })
}
