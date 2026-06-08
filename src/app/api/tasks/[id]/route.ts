import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculatePriority } from '@/lib/utils'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const existing = await prisma.task.findUnique({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const importance = body.importance ?? existing.importance
  const urgency = body.urgency ?? existing.urgency
  const priority = calculatePriority(importance, urgency)

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...body,
      importance,
      urgency,
      priority,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
      scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : undefined,
      scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : undefined,
      completedAt: body.status === 'COMPLETED' ? new Date() : undefined,
    },
    include: { subTasks: true, calendarAccount: true },
  })

  return NextResponse.json(task)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.task.findUnique({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
