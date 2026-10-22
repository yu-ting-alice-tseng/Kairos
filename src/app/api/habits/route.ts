import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { loadUserHabits } from '@/lib/queries'
import { getRequestTimeZone } from '@/lib/timezone-server'
import { z } from 'zod'
import { isDemoUser } from '@/lib/demo-data'

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

  return NextResponse.json(await loadUserHabits(session.user.id, await getRequestTimeZone()))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createHabitSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const d = parsed.data

  // Demo habits are served from fixed data, so a stored one would vanish on
  // reload: echo it instead, like demo task creation.
  if (isDemoUser(session.user.id)) {
    const now = new Date()
    return NextResponse.json({ id: `demo-h-${Date.now()}`, userId: session.user.id, ...d, description: d.description ?? null, icon: d.icon ?? null, targetDays: d.targetDays ?? null, scheduledTime: d.scheduledTime ?? null, durationMinutes: d.durationMinutes ?? null, isActive: true, streak: 0, longestStreak: 0, createdAt: now, updatedAt: now, completions: [] }, { status: 201 })
  }

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
