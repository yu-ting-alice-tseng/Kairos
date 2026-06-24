import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const allowedFields = ['title', 'description', 'color', 'icon', 'frequency', 'targetDays', 'scheduledTime', 'durationMinutes', 'importance', 'urgency', 'isActive', 'streak', 'longestStreak']
  const data: Record<string, unknown> = Object.fromEntries(Object.entries(body).filter(([k]) => allowedFields.includes(k)))

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
