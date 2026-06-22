import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDemoUser, getDemoHabits } from '@/lib/demo-data'
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

  const habit = await prisma.habit.create({
    data: { userId: session.user.id, ...parsed.data },
  })

  return NextResponse.json(habit, { status: 201 })
}
