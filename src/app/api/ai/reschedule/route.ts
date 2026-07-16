import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { suggestReschedule } from '@/lib/ai'
import { prisma } from '@/lib/prisma'
import { addMinutes, addDays, setHours, setMinutes } from 'date-fns'
import { z } from 'zod'

const reschedulePostSchema = z.object({
  taskId: z.string().min(1),
  lang: z.string().max(10).optional(),
})
const reschedulePatchSchema = z.object({
  taskId: z.string().min(1),
  start: z.string().datetime(),
  end: z.string().datetime(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = reschedulePostSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { taskId, lang } = parsed.data

  const task = await prisma.task.findUnique({
    where: { id: taskId, userId: session.user.id },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existingEvents = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      scheduledStart: { not: null },
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    select: { scheduledStart: true, scheduledEnd: true },
  })

  const tomorrow = addDays(new Date(), 1)
  const slots = [9, 11, 14, 16].map((hour) => {
    const start = setMinutes(setHours(new Date(tomorrow), hour), 0)
    const end = addMinutes(start, task.estimatedMinutes ?? 60)
    return { start: start.toISOString(), end: end.toISOString() }
  })

  const occupied = existingEvents
    .filter((e) => e.scheduledStart && e.scheduledEnd)
    .map((e) => ({ start: e.scheduledStart!.toISOString(), end: e.scheduledEnd!.toISOString() }))

  const available = slots.filter(
    (slot) =>
      !occupied.some(
        (ev) => new Date(slot.start) < new Date(ev.end) && new Date(slot.end) > new Date(ev.start)
      )
  )

  try {
    const suggestion = await suggestReschedule(
      task as never,
      available.length > 0 ? available : slots,
      (lang ?? 'fr') as 'fr' | 'en' | 'zh'
    )

    return NextResponse.json({ suggestion, availableSlots: available.length > 0 ? available : slots })
  } catch (err) {
    console.error('Reschedule error:', err)
    return NextResponse.json({ error: 'AI error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = reschedulePatchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { taskId, start, end } = parsed.data

  const task = await prisma.task.update({
    where: { id: taskId, userId: session.user.id },
    data: {
      scheduledStart: new Date(start),
      scheduledEnd: new Date(end),
      status: 'RESCHEDULED',
    },
  })

  return NextResponse.json(task)
}
