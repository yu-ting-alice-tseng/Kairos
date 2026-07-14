import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const habitPatchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  color: z.string().max(50).optional(),
  icon: z.string().max(10).optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'WEEKDAYS', 'WEEKENDS', 'CUSTOM']).optional(),
  targetDays: z.string().max(50).optional(),
  scheduledTime: z.string().max(10).optional(),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  importance: z.number().int().min(1).max(10).optional(),
  urgency: z.number().int().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
  streak: z.number().int().min(0).optional(),
  longestStreak: z.number().int().min(0).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = habitPatchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const data = parsed.data

  const habit = await prisma.habit.update({
    where: { id, userId: session.user.id },
    data,
    include: { completions: true },
  })

  return NextResponse.json(habit)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.habit.update({
    where: { id, userId: session.user.id },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
