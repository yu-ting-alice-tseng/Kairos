import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { loadUserHabits } from '@/lib/queries'
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
  importance: z.number().int().min(1).max(10).default(5),
  urgency: z.number().int().min(1).max(10).default(5),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(await loadUserHabits(session.user.id))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createHabitSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const d = parsed.data
  try {
    const habit = await prisma.habit.create({
      data: {
        userId: session.user.id,
        title: d.title,
        color: d.color,
        frequency: d.frequency,
        importance: d.importance,
        urgency: d.urgency,
        isActive: true,
        description: d.description || undefined,
        icon: d.icon || undefined,
        targetDays: d.targetDays || undefined,
        scheduledTime: d.scheduledTime || undefined,
        durationMinutes: d.durationMinutes || undefined,
      },
      include: {
        completions: true,
      },
    })
    return NextResponse.json(habit, { status: 201 })
  } catch (err) {
    console.error('[POST /api/habits] Prisma create failed:', err)
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 })
  }
}
